import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: 'https://e8cfed9b8cc1861dc4a667576fe1d522@o4508739047325696.ingest.us.sentry.io/4511062264709120',
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});
