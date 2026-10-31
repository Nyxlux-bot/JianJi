// APP_VARIANT=development 时出开发包：换包名、应用名和链接协议，能和正式包装在同一台设备上。
// 不设变量（Actions 发版、发版脚本）时原样用 app.json。
module.exports = ({ config }) => {
    if (process.env.APP_VARIANT !== 'development') return config;
    return {
        ...config,
        name: '见机开发版',
        scheme: 'jianji-dev',
        ios: { ...config.ios, bundleIdentifier: 'com.jianji.app.dev' },
        android: { ...config.android, package: 'com.jianji.app.dev' },
    };
};
