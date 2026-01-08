import { Router, Request, Response } from 'express';
import { paymentService } from '../services/paymentService.js';

const router = Router();

/**
 * Mock Payment Routes
 * These endpoints simulate Razorpay payment flow for development/testing
 * Only available when RAZORPAY_MOCK_MODE=true or no Razorpay keys configured
 */

// Mock payment page (simulates Razorpay checkout)
router.get('/:orderId', async (req: Request, res: Response) => {
  try {
    if (!paymentService.isMockMode()) {
      return res.status(404).json({ error: 'Mock payments not available' });
    }

    const { orderId } = req.params;
    const order = paymentService.getMockOrder(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Return a simple HTML page for mock payment
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mock Payment - Ankiya Cloud</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      padding: 40px;
      max-width: 400px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .mock-badge {
      background: #fef3c7;
      color: #92400e;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
      display: inline-block;
    }
    h1 {
      color: #1f2937;
      font-size: 24px;
      margin-bottom: 8px;
    }
    .amount {
      font-size: 36px;
      font-weight: 700;
      color: #059669;
      margin: 20px 0;
    }
    .order-id {
      color: #6b7280;
      font-size: 14px;
      word-break: break-all;
    }
    .divider {
      border-top: 1px solid #e5e7eb;
      margin: 24px 0;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    button {
      padding: 14px 24px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .success-btn {
      background: #059669;
      color: white;
    }
    .success-btn:hover {
      background: #047857;
    }
    .fail-btn {
      background: #f3f4f6;
      color: #374151;
    }
    .fail-btn:hover {
      background: #e5e7eb;
    }
    .info {
      margin-top: 24px;
      padding: 16px;
      background: #eff6ff;
      border-radius: 8px;
      font-size: 14px;
      color: #1e40af;
    }
    .loading {
      display: none;
      text-align: center;
      padding: 20px;
    }
    .spinner {
      border: 3px solid #e5e7eb;
      border-top: 3px solid #059669;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="card">
    <div id="payment-form">
      <div class="header">
        <span class="mock-badge">🧪 MOCK PAYMENT</span>
        <h1>Ankiya Cloud</h1>
        <div class="amount">₹${(order.amount / 100).toLocaleString('en-IN')}</div>
        <div class="order-id">Order: ${orderId}</div>
      </div>
      
      <div class="divider"></div>
      
      <div class="buttons">
        <button class="success-btn" onclick="completePayment(true)">
          ✓ Complete Payment (Success)
        </button>
        <button class="fail-btn" onclick="completePayment(false)">
          ✗ Decline Payment (Fail)
        </button>
      </div>
      
      <div class="info">
        <strong>Development Mode</strong><br>
        This is a simulated payment. No real transaction will occur.
      </div>
    </div>
    
    <div class="loading" id="loading">
      <div class="spinner"></div>
      <p>Processing payment...</p>
    </div>
  </div>

  <script>
    async function completePayment(success) {
      document.getElementById('payment-form').style.display = 'none';
      document.getElementById('loading').style.display = 'block';
      
      try {
        const response = await fetch('/api/mock-payment/${orderId}/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ success })
        });
        
        const data = await response.json();
        
        if (data.success) {
          // Redirect back to app with success
          window.opener?.postMessage({
            type: 'PAYMENT_SUCCESS',
            orderId: data.orderId,
            paymentId: data.paymentId,
            signature: data.signature
          }, '*');
          window.close();
        } else {
          // Redirect back with failure
          window.opener?.postMessage({
            type: 'PAYMENT_FAILED',
            orderId: '${orderId}',
            error: data.error
          }, '*');
          window.close();
        }
      } catch (error) {
        alert('Error processing mock payment');
        window.location.reload();
      }
    }
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Mock payment page error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Complete mock payment
router.post('/:orderId/complete', async (req: Request, res: Response) => {
  try {
    if (!paymentService.isMockMode()) {
      return res.status(404).json({ error: 'Mock payments not available' });
    }

    const { orderId } = req.params;
    const { success = true } = req.body;

    const result = await paymentService.completeMockPayment(orderId, success);
    res.json(result);
  } catch (error: any) {
    console.error('Mock payment completion error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Check mock mode status
router.get('/status/mode', (req: Request, res: Response) => {
  res.json({
    mockMode: paymentService.isMockMode(),
    message: paymentService.isMockMode()
      ? 'Running in MOCK mode - no real payments will be processed'
      : 'Running in LIVE mode - connected to Razorpay',
  });
});

export default router;
