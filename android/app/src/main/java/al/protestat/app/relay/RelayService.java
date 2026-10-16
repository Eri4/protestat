package al.protestat.app.relay;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.io.File;

/**
 * Keeps the group relay running while the screen is off, shown as an ongoing notification.
 * Started and stopped only by the user from the app (Share → Group).
 */
public class RelayService extends Service {
    public static final String ACTION_STOP = "al.protestat.app.relay.STOP";
    private static final String CHANNEL = "protestat-relay";
    private static final int NOTIFICATION_ID = 8787;
    private static final long TTL_MS = 72L * 3600_000L;

    private static RelayServer server;
    private static int port;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    public static synchronized RelayServer server() {
        return server;
    }

    public static synchronized int port() {
        return port;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        int wanted = intent != null ? intent.getIntExtra("port", 8787) : 8787;
        startInForeground();
        synchronized (RelayService.class) {
            if (server == null || !server.isRunning()) {
                server = new RelayServer(new File(getFilesDir(), "relay.tsv"), TTL_MS);
                try {
                    port = server.start(wanted);
                } catch (Exception e) {
                    try {
                        port = server.start(0); // wanted port busy: let the system pick one
                    } catch (Exception e2) {
                        server = null;
                        stopSelf();
                        return START_NOT_STICKY;
                    }
                }
            }
        }
        acquireLocks();
        return START_STICKY;
    }

    private void startInForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Protestat – grupi", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Serveri i grupit në këtë telefon");
            nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent stop = new Intent(this, RelayService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle("Protestat: serveri i grupit është ndezur")
            .setContentText("Telefonat e grupit në të njëjtin Wi-Fi/hotspot ndajnë raporte. Prek për të hapur.")
            .setOngoing(true)
            .setContentIntent(openPi)
            .addAction(0, "Ndalo", stopPi)
            .build();
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, n, type);
    }

    private void acquireLocks() {
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "protestat:relay");
            wakeLock.acquire(6 * 3600_000L); // never longer than 6 hours
        }
        if (wifiLock == null) {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "protestat:relay");
                wifiLock.acquire();
            }
        }
    }

    @Override
    public void onTimeout(int startId, int fgsType) {
        // Android 15 limits data-sync services to 6 hours a day: stop cleanly when told to.
        stopSelf();
    }

    @Override
    public void onDestroy() {
        synchronized (RelayService.class) {
            if (server != null) server.stop();
            server = null;
            port = 0;
        }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
