(function (app) {
    // Device mode 尚未進入 MVP；先保留穩定 API 形狀給未來 ESP32 整合。
    // 目前任何呼叫都應明確失敗，避免使用者誤以為已支援上傳到裝置。
    app.device.api = {
        enabled: false
    };
})(window.DitherApp);
