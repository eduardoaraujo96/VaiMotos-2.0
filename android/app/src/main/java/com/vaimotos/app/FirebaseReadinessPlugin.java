package com.vaimotos.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FirebaseReadiness")
public class FirebaseReadinessPlugin extends Plugin {

    @PluginMethod
    public void isConfigured(PluginCall call) {
        JSObject result = new JSObject();
        int firebaseAppId = getContext().getResources().getIdentifier(
            "google_app_id",
            "string",
            getContext().getPackageName()
        );
        result.put("configured", firebaseAppId != 0);
        call.resolve(result);
    }
}
