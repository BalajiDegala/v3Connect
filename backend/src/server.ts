import { config } from './config/index.js';
import app from './app.js';
import { startOrderExpiryJob } from './jobs/orderExpiryJob.js';
import { startMachineExpiryJob } from './jobs/machineExpiryJob.js';

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  🚀 Ankiya Cloud Backend Server
  ================================
  Server running on: http://localhost:${PORT}
  Environment: ${config.nodeEnv}
  Keycloak: ${config.keycloak.url}
  ================================
  `);
  
  // Start background jobs
  startOrderExpiryJob();
  startMachineExpiryJob();
});

export default app;
