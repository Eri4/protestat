package al.protestat.app.relay;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The Protestat relay protocol (v1), in plain Java so it runs inside the Android app
 * ("host on this phone") and can be tested on any JVM. Same behaviour as server/relay.mjs:
 *
 *   GET  /v1/health                         -> { ok, app, version, ttlHours }
 *   POST /v1/g/&lt;group&gt;/blobs  {iv, data}    -> 201 { seq }
 *   GET  /v1/g/&lt;group&gt;/blobs?after=N        -> { items: [{ seq, t, iv, data }], next }
 *
 * It stores only encrypted blobs; it never sees the group key.
 */
public final class RelayServer {
    private static final Pattern GROUP = Pattern.compile("^[A-Za-z0-9_-]{16,64}$");
    private static final Pattern B64 = Pattern.compile("^[A-Za-z0-9+/=_-]+$");
    private static final Pattern BLOBS = Pattern.compile("^/v1/g/([^/]+)/blobs$");
    private static final Pattern FIELD_IV = Pattern.compile("\"iv\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern FIELD_DATA = Pattern.compile("\"data\"\\s*:\\s*\"([^\"]*)\"");
    private static final int MAX_BODY = 1_500_000;
    private static final int PAGE = 100;
    private static final int MAX_ITEMS = 2000;
    private static final int MAX_GROUPS = 500;

    private static final class Item {
        final long seq;
        final long t;
        final String iv;
        final String data;

        Item(long seq, long t, String iv, String data) {
            this.seq = seq;
            this.t = t;
            this.iv = iv;
            this.data = data;
        }
    }

    private static final class Group {
        long seq;
        final List<Item> items = new ArrayList<>();
    }

    private final Map<String, Group> groups = new HashMap<>();
    private final long ttlMs;
    private final File dataFile;
    private ServerSocket socket;
    private ExecutorService pool;
    private volatile boolean running;

    public RelayServer(File dataFile, long ttlMs) {
        this.dataFile = dataFile;
        this.ttlMs = ttlMs;
    }

    public synchronized int start(int port) throws IOException {
        if (running) return socket.getLocalPort();
        load();
        socket = new ServerSocket();
        socket.setReuseAddress(true);
        socket.bind(new InetSocketAddress("0.0.0.0", port));
        pool = Executors.newFixedThreadPool(8);
        running = true;
        Thread accept = new Thread(this::acceptLoop, "protestat-relay");
        accept.setDaemon(true);
        accept.start();
        return socket.getLocalPort();
    }

    public synchronized void stop() {
        running = false;
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {
        }
        if (pool != null) pool.shutdownNow();
        save();
    }

    public boolean isRunning() {
        return running;
    }

    public synchronized int itemCount() {
        int n = 0;
        for (Group g : groups.values()) n += g.items.size();
        return n;
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket s = socket.accept();
                pool.execute(() -> handle(s));
            } catch (IOException e) {
                if (!running) return;
            }
        }
    }

    private void handle(Socket s) {
        try (Socket client = s) {
            client.setSoTimeout(10_000);
            InputStream in = client.getInputStream();
            String requestLine = readLine(in);
            if (requestLine == null) return;
            String[] parts = requestLine.split(" ");
            if (parts.length < 2) return;
            String method = parts[0];
            String target = parts[1];
            int contentLength = 0;
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int c = line.indexOf(':');
                if (c > 0 && line.substring(0, c).trim().equalsIgnoreCase("content-length")) {
                    contentLength = Integer.parseInt(line.substring(c + 1).trim());
                }
            }
            String path = target;
            String query = "";
            int q = target.indexOf('?');
            if (q >= 0) {
                path = target.substring(0, q);
                query = target.substring(q + 1);
            }
            Response r;
            if (contentLength > MAX_BODY) {
                r = new Response(413, "{\"error\":\"bad-body\"}");
            } else {
                byte[] body = readBytes(in, contentLength);
                r = route(method, path, query, new String(body, StandardCharsets.UTF_8));
            }
            write(client.getOutputStream(), r);
        } catch (Exception ignored) {
        }
    }

    private static final class Response {
        final int status;
        final String body;

        Response(int status, String body) {
            this.status = status;
            this.body = body;
        }
    }

    synchronized Response route(String method, String path, String query, String body) {
        if (method.equals("OPTIONS")) return new Response(204, "");
        if (method.equals("GET") && path.equals("/v1/health")) {
            return new Response(200, "{\"ok\":true,\"app\":\"protestat-relay\",\"version\":1,\"ttlHours\":" + (ttlMs / 3600000L) + "}");
        }
        Matcher m = BLOBS.matcher(path);
        if (!m.matches() || !GROUP.matcher(m.group(1)).matches()) return new Response(404, "{\"error\":\"not-found\"}");
        String gid = m.group(1);
        prune();
        if (method.equals("GET")) {
            long after = 0;
            for (String kv : query.split("&")) {
                if (kv.startsWith("after=")) {
                    try {
                        after = Math.max(0, Long.parseLong(URLDecoder.decode(kv.substring(6), "UTF-8")));
                    } catch (Exception ignored) {
                    }
                }
            }
            Group g = groups.get(gid);
            StringBuilder sb = new StringBuilder("{\"items\":[");
            long next = after;
            int n = 0;
            if (g != null) {
                for (Item it : g.items) {
                    if (it.seq <= after) continue;
                    if (n++ > 0) sb.append(',');
                    sb.append("{\"seq\":").append(it.seq).append(",\"t\":").append(it.t)
                        .append(",\"iv\":\"").append(it.iv).append("\",\"data\":\"").append(it.data).append("\"}");
                    next = it.seq;
                    if (n >= PAGE) break;
                }
            }
            sb.append("],\"next\":").append(next).append('}');
            return new Response(200, sb.toString());
        }
        if (method.equals("POST")) {
            Matcher iv = FIELD_IV.matcher(body);
            Matcher data = FIELD_DATA.matcher(body);
            if (!iv.find() || !data.find()) return new Response(400, "{\"error\":\"bad-body\"}");
            String ivs = iv.group(1);
            String ds = data.group(1);
            if (ivs.isEmpty() || ivs.length() > 64 || ds.isEmpty() || !B64.matcher(ivs).matches() || !B64.matcher(ds).matches()) {
                return new Response(400, "{\"error\":\"bad-body\"}");
            }
            Group g = groups.get(gid);
            if (g == null) {
                if (groups.size() >= MAX_GROUPS) return new Response(507, "{\"error\":\"full\"}");
                g = new Group();
                groups.put(gid, g);
            }
            g.seq += 1;
            g.items.add(new Item(g.seq, System.currentTimeMillis(), ivs, ds));
            if (g.items.size() > MAX_ITEMS) g.items.remove(0);
            save();
            return new Response(201, "{\"seq\":" + g.seq + "}");
        }
        return new Response(405, "{\"error\":\"method\"}");
    }

    private void prune() {
        long now = System.currentTimeMillis();
        Iterator<Map.Entry<String, Group>> it = groups.entrySet().iterator();
        while (it.hasNext()) {
            Group g = it.next().getValue();
            g.items.removeIf(x -> now - x.t >= ttlMs);
            if (g.items.isEmpty()) it.remove();
        }
    }

    // ---- persistence: one line per item, tab-separated ----

    private synchronized void load() {
        groups.clear();
        if (dataFile == null || !dataFile.exists()) return;
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(dataFile), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                String[] f = line.split("\t");
                if (f.length != 5 || !GROUP.matcher(f[0]).matches()) continue;
                Group g = groups.computeIfAbsent(f[0], k -> new Group());
                long seq = Long.parseLong(f[1]);
                g.items.add(new Item(seq, Long.parseLong(f[2]), f[3], f[4]));
                g.seq = Math.max(g.seq, seq);
            }
        } catch (Exception ignored) {
        }
        prune();
    }

    private synchronized void save() {
        if (dataFile == null) return;
        File tmp = new File(dataFile.getPath() + ".tmp");
        try (BufferedWriter w = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(tmp), StandardCharsets.UTF_8))) {
            for (Map.Entry<String, Group> e : groups.entrySet()) {
                for (Item it : e.getValue().items) {
                    w.write(e.getKey() + "\t" + it.seq + "\t" + it.t + "\t" + it.iv + "\t" + it.data + "\n");
                }
            }
        } catch (IOException e) {
            return;
        }
        //noinspection ResultOfMethodCallIgnored
        tmp.renameTo(dataFile);
    }

    // ---- tiny HTTP helpers ----

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 8192) throw new IOException("line too long");
        }
        if (c == -1 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }

    private static byte[] readBytes(InputStream in, int n) throws IOException {
        byte[] buf = new byte[n];
        int off = 0;
        while (off < n) {
            int r = in.read(buf, off, n - off);
            if (r < 0) break;
            off += r;
        }
        return buf;
    }

    private static void write(OutputStream out, Response r) throws IOException {
        byte[] body = r.body.getBytes(StandardCharsets.UTF_8);
        String reason = r.status == 200 ? "OK" : r.status == 201 ? "Created" : r.status == 204 ? "No Content" : "Error";
        String head = "HTTP/1.1 " + r.status + " " + reason + "\r\n"
            + "Content-Type: application/json\r\n"
            + "Access-Control-Allow-Origin: *\r\n"
            + "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
            + "Access-Control-Allow-Headers: Content-Type\r\n"
            + "Cache-Control: no-store\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.US_ASCII));
        out.write(body);
        out.flush();
    }

    /** Lets tests (and the desktop) run the phone relay: java RelayServer [port] [dataFile]. */
    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8787;
        File f = args.length > 1 ? new File(args[1]) : null;
        RelayServer s = new RelayServer(f, 72L * 3600_000L);
        System.out.println("listening " + s.start(port));
        Thread.currentThread().join();
    }
}
