package com.getyere.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void load() {
        // BridgeActivity calls this after adding the generated plugins. Adding our
        // same-ID subclass last keeps official push APIs but guards Firebase errors.
        registerPlugin(YerePushNotificationsPlugin.class);
        super.load();
    }
}
