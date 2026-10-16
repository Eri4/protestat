package al.protestat.app.relay;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Collections;

/** JS bridge: start/stop/status of the group relay running on this phone. */
@CapacitorPlugin(name = "RelayHost")
public class RelayHostPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        int port = call.getInt("port", 8787);
        Intent i = new Intent(getContext(), RelayService.class).putExtra("port", port);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i);
        else getContext().startService(i);
        // Give the service a moment to bind the port, then report where it listens.
        new Thread(() -> {
            for (int n = 0; n < 40; n++) {
                RelayServer s = RelayService.server();
                if (s != null && s.isRunning()) {
                    JSObject r = new JSObject();
                    r.put("port", RelayService.port());
                    r.put("addresses", addresses());
                    call.resolve(r);
                    return;
                }
                try {
                    Thread.sleep(100);
                } catch (InterruptedException ignored) {
                }
            }
            call.reject("could-not-start");
        }).start();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), RelayService.class));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        RelayServer s = RelayService.server();
        JSObject r = new JSObject();
        r.put("running", s != null && s.isRunning());
        r.put("port", RelayService.port());
        r.put("addresses", addresses());
        r.put("items", s != null ? s.itemCount() : 0);
        call.resolve(r);
    }

    /** This phone's local IPv4 addresses (Wi-Fi and hotspot), e.g. 192.168.43.1. */
    private static JSArray addresses() {
        JSArray out = new JSArray();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) out.put(a.getHostAddress());
                }
            }
        } catch (Exception ignored) {
        }
        return out;
    }
}
