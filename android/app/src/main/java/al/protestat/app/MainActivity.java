package al.protestat.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import al.protestat.app.relay.RelayHostPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The "host the group on this phone" server (Share → Group).
        registerPlugin(RelayHostPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
