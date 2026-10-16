package com.getyere.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * Displays Yere's data-only FCM messages with native reminder actions and still
 * forwards every message/token to the official Capacitor push plugin.
 */
public final class YereMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "yere_reminders";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        PushNotificationsPlugin.sendRemoteMessage(message);

        Map<String, String> data = message.getData();
        String title = value(data, "title", "A reminder from Yere");
        String body = value(data, "body", "It is time for a reminder you wanted to keep.");
        String reminderId = value(data, "reminderId", value(data, "reminder_id", ""));
        showReminder(title, body, reminderId, value(data, "tag", message.getMessageId()));
    }

    private void showReminder(String title, String body, String reminderId, String tag) {
        createReminderChannel();
        int notificationId = (tag == null ? title : tag).hashCode() & 0x7fffffff;

        PendingIntent viewIntent = appIntent(reminderId, "view", 0, false, notificationId + 1);
        PendingIntent snoozeIntent = appIntent(reminderId, "snooze", 10, true, notificationId + 2);
        PendingIntent doneIntent = appIntent(reminderId, "done", 0, true, notificationId + 3);

        NotificationCompat.Builder notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_yere)
            .setColor(Color.rgb(99, 102, 241))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(viewIntent)
            .addAction(0, "Snooze 10 min", snoozeIntent)
            .addAction(0, "Done", doneIntent)
            .addAction(0, "View", viewIntent);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        NotificationManagerCompat.from(this).notify(tag, notificationId, notification.build());
    }

    private PendingIntent appIntent(String reminderId, String action, int minutes, boolean direct, int requestCode) {
        Uri.Builder deepLink = new Uri.Builder()
            .scheme("yere")
            .authority("reminder")
            .appendPath(reminderId == null ? "" : reminderId)
            .appendQueryParameter("action", action);
        if (minutes > 0) deepLink.appendQueryParameter("minutes", String.valueOf(minutes));
        if (direct) deepLink.appendQueryParameter("direct", "1");

        Intent intent = new Intent(Intent.ACTION_VIEW, deepLink.build(), this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createReminderChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Yere reminders",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Reminders you have chosen to receive from Yere.");
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLightColor(Color.rgb(99, 102, 241));
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }

    private static String value(Map<String, String> data, String key, String fallback) {
        String value = data.get(key);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }
}
