package com.getyere.app;

import android.Manifest;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailabilityLight;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Keep the official permission/channel/action implementation, but reject native
 * Firebase setup failures instead of throwing them out of Capacitor's worker.
 * A JavaScript try/catch cannot catch a process-fatal Java exception.
 */
@CapacitorPlugin(
    name = "PushNotifications",
    permissions = @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "receive")
)
public class YerePushNotificationsPlugin extends PushNotificationsPlugin {
    @Override
    @PluginMethod
    public void register(PluginCall call) {
        try {
            // getInstance throws if the compiled client resources did not initialise Firebase.
            FirebaseOptions options = FirebaseApp.getInstance().getOptions();
            if (blank(options.getApplicationId()) || blank(options.getGcmSenderId())
                || blank(options.getProjectId()) || blank(options.getApiKey())) {
                rejectConfiguration(call);
                return;
            }
            if (GoogleApiAvailabilityLight.getInstance().isGooglePlayServicesAvailable(getContext()) != ConnectionResult.SUCCESS) {
                call.reject("Notifications need up-to-date Google Play services on this device.", "YERE_PUSH_PLAY_SERVICES");
                return;
            }
            FirebaseMessaging messaging = FirebaseMessaging.getInstance();
            messaging.setAutoInitEnabled(true);
            messaging.getToken().addOnCompleteListener(task -> {
                if (!task.isSuccessful() || blank(task.getResult())) {
                    // Do not expose tokens, client config or provider exception contents.
                    sendError("Android push registration failed. Check the connection, Google Play services and this build's Firebase configuration.");
                    return;
                }
                sendToken(task.getResult());
            });
            call.resolve();
        } catch (RuntimeException error) {
            rejectConfiguration(call);
        }
    }

    @Override
    @PluginMethod
    public void unregister(PluginCall call) {
        final FirebaseMessaging messaging;
        try {
            FirebaseApp.getInstance();
            messaging = FirebaseMessaging.getInstance();
        } catch (IllegalStateException noFirebaseApp) {
            // Signing out of an incorrectly configured installation must not crash it.
            call.resolve();
            return;
        } catch (RuntimeException error) {
            call.reject("Could not clear this device's notification registration.", "YERE_PUSH_UNREGISTER");
            return;
        }
        try {
            messaging.setAutoInitEnabled(false);
            messaging.deleteToken().addOnCompleteListener(task -> {
                if (task.isSuccessful()) call.resolve();
                else call.reject("Could not clear this device's notification registration. Try again when connected.", "YERE_PUSH_UNREGISTER");
            });
        } catch (RuntimeException error) {
            call.reject("Could not clear this device's notification registration.", "YERE_PUSH_UNREGISTER");
        }
    }

    private static void rejectConfiguration(PluginCall call) {
        call.reject("Notifications are unavailable in this Android build. Install the corrected store update with Firebase configured.", "YERE_PUSH_CONFIGURATION");
    }

    private static boolean blank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
