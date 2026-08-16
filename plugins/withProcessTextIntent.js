const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE_PATH = "com/deepcoomer/edgemindlab";
const PACKAGE_NAME = "com.deepcoomer.edgemindlab";
const ACTIVITY_NAME = "ShareReceiverActivity";

const KOTLIN_SOURCE = `package ${PACKAGE_NAME}

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Trampoline activity: receives text shared via the Android share sheet or
 * the text-selection "..." popup (ACTION_PROCESS_TEXT) from other apps,
 * forwards it into the app as a normal edgemindlab:// deep link so it can
 * reuse expo-router's existing linking, then closes itself invisibly.
 */
class ${ACTIVITY_NAME} : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sharedText: String? = when (intent?.action) {
            Intent.ACTION_SEND ->
                if (intent.type == "text/plain") intent.getStringExtra(Intent.EXTRA_TEXT) else null
            Intent.ACTION_PROCESS_TEXT ->
                intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
            else -> null
        }

        if (!sharedText.isNullOrEmpty()) {
            val deepLink = Uri.parse("edgemindlab://tasks?sharedText=" + Uri.encode(sharedText))
            val forwardIntent = Intent(Intent.ACTION_VIEW, deepLink)
            forwardIntent.setPackage(packageName)
            forwardIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(forwardIntent)
        }

        finish()
    }
}
`;

function withShareReceiverSource(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const dir = path.join(config.modRequest.platformProjectRoot, "app/src/main/java", PACKAGE_PATH);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${ACTIVITY_NAME}.kt`), KOTLIN_SOURCE);
      return config;
    },
  ]);
}

function withShareReceiverManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = config.modResults.manifest.application[0];
    app.activity = app.activity || [];
    app.activity = app.activity.filter((a) => a.$["android:name"] !== `.${ACTIVITY_NAME}`);

    app.activity.push({
      $: {
        "android:name": `.${ACTIVITY_NAME}`,
        "android:exported": "true",
        "android:theme": "@android:style/Theme.NoDisplay",
        "android:excludeFromRecents": "true",
      },
      "intent-filter": [
        {
          action: [{ $: { "android:name": "android.intent.action.SEND" } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
          data: [{ $: { "android:mimeType": "text/plain" } }],
        },
        {
          action: [{ $: { "android:name": "android.intent.action.PROCESS_TEXT" } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
          data: [{ $: { "android:mimeType": "text/plain" } }],
        },
      ],
    });

    return config;
  });
}

module.exports = function withProcessTextIntent(config) {
  config = withShareReceiverSource(config);
  config = withShareReceiverManifest(config);
  return config;
};
