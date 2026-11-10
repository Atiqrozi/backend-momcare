export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  frontendOrigins: (process.env.FRONTEND_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '1h',
  },
  passwordHashRounds: Number(process.env.PASSWORD_HASH_ROUNDS ?? 12),
  encryption: {
    masterKey: process.env.ENCRYPTION_MASTER_KEY,
  },
  email: {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT ?? 587),
    smtpSecure: process.env.SMTP_SECURE === undefined
      ? Number(process.env.SMTP_PORT ?? 587) === 465
      : process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER,
    smtpPassword: process.env.SMTP_PASSWORD,
    from: process.env.EMAIL_FROM,
  },
  waha: {
    baseUrl: process.env.WAHA_BASE_URL,
    apiKey: process.env.WAHA_API_KEY,
    session: process.env.WAHA_SESSION ?? 'default',
    enabled: process.env.WAHA_ENABLED === 'true',
  },
  chatAi: {
    endpoint: process.env.CHAT_AI_ENDPOINT,
    apiKey: process.env.CHAT_AI_API_KEY,
    model: process.env.CHAT_AI_MODEL,
  },
  imageKit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  },
  googleSheets: {
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '1nFZAn_tQl_3JhCFtLZOKpLBzL7KaPYFKUwAvOn87jb0',
    scheduleTab: process.env.GOOGLE_SHEETS_SCHEDULE_TAB ?? 'Sheet1',
  },
});
