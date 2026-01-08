import Razorpay from 'razorpay';
import crypto from 'crypto';
import { config } from '../config/index.js';

// Mock payment data storage (in-memory for development)
const mockOrders = new Map<string, any>();
const mockPayments = new Map<string, any>();

class PaymentService {
  private razorpay: Razorpay | null = null;
  private mockMode: boolean;

  constructor() {
    this.mockMode = config.razorpay.mockMode;

    if (this.mockMode) {
      console.log('💳 Payment Service: Running in MOCK MODE (no real payments)');
      console.log('   Set RAZORPAY_KEY_ID and RAZORPAY_MOCK_MODE=false for real payments');
    } else {
      this.razorpay = new Razorpay({
        key_id: config.razorpay.keyId,
        key_secret: config.razorpay.keySecret,
      });
      console.log('💳 Payment Service: Connected to Razorpay');
    }
  }

  private generateMockId(prefix: string): string {
    return `${prefix}_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async createOrder(amount: number, currency: string = 'INR', receipt: string): Promise<any> {
    // MOCK MODE
    if (this.mockMode) {
      const orderId = this.generateMockId('order');
      const mockOrder = {
        id: orderId,
        entity: 'order',
        amount: Math.round(amount * 100),
        amount_paid: 0,
        amount_due: Math.round(amount * 100),
        currency,
        receipt,
        status: 'created',
        attempts: 0,
        notes: { platform: 'Ankiya Cloud', mode: 'mock' },
        created_at: Math.floor(Date.now() / 1000),
        // Mock-specific fields for frontend
        _mock: true,
        _mockPaymentUrl: `/api/mock-payment/${orderId}`,
      };
      mockOrders.set(orderId, mockOrder);
      console.log(`[MOCK] Created order: ${orderId} for ₹${amount}`);
      return mockOrder;
    }

    // REAL MODE
    try {
      const order = await this.razorpay!.orders.create({
        amount: Math.round(amount * 100),
        currency,
        receipt,
        notes: {
          platform: 'Ankiya Cloud',
        },
      });
      return order;
    } catch (error) {
      console.error('Razorpay order creation failed:', error);
      throw new Error('Failed to create payment order');
    }
  }

  // Mock payment completion (for testing)
  async completeMockPayment(orderId: string, success: boolean = true): Promise<any> {
    if (!this.mockMode) {
      throw new Error('Mock payment only available in mock mode');
    }

    const order = mockOrders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (success) {
      const paymentId = this.generateMockId('pay');
      const mockPayment = {
        id: paymentId,
        entity: 'payment',
        amount: order.amount,
        currency: order.currency,
        status: 'captured',
        order_id: orderId,
        method: 'card',
        card: {
          last4: '1111',
          network: 'Visa',
          type: 'credit',
        },
        email: 'test@example.com',
        contact: '+919999999999',
        created_at: Math.floor(Date.now() / 1000),
        _mock: true,
      };

      // Generate mock signature
      const mockSignature = crypto
        .createHmac('sha256', 'mock_secret_key')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      mockPayments.set(paymentId, mockPayment);
      order.status = 'paid';
      order.amount_paid = order.amount;
      order.amount_due = 0;

      console.log(`[MOCK] Payment completed: ${paymentId} for order ${orderId}`);

      return {
        success: true,
        orderId,
        paymentId,
        signature: mockSignature,
        // Razorpay-compatible field names for frontend
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: mockSignature,
        payment: mockPayment,
      };
    } else {
      order.status = 'failed';
      console.log(`[MOCK] Payment failed for order ${orderId}`);
      return {
        success: false,
        orderId,
        error: 'Payment declined (mock)',
      };
    }
  }

  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
  ): boolean {
    // MOCK MODE - accept mock signatures
    if (this.mockMode) {
      const expectedMockSignature = crypto
        .createHmac('sha256', 'mock_secret_key')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
      
      const isValid = expectedMockSignature === signature;
      console.log(`[MOCK] Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    }

    // REAL MODE
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(text)
      .digest('hex');

    return expectedSignature === signature;
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    if (this.mockMode) {
      console.log('[MOCK] Webhook signature auto-verified');
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.razorpay.webhookSecret)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  async fetchPayment(paymentId: string): Promise<any> {
    // MOCK MODE
    if (this.mockMode) {
      const mockPayment = mockPayments.get(paymentId);
      if (mockPayment) {
        return mockPayment;
      }
      throw new Error('Mock payment not found');
    }

    // REAL MODE
    try {
      return await this.razorpay!.payments.fetch(paymentId);
    } catch (error) {
      console.error('Failed to fetch payment:', error);
      throw new Error('Failed to fetch payment details');
    }
  }

  async createRefund(paymentId: string, amount?: number): Promise<any> {
    // MOCK MODE
    if (this.mockMode) {
      const payment = mockPayments.get(paymentId);
      if (!payment) {
        throw new Error('Mock payment not found');
      }

      const refundId = this.generateMockId('rfnd');
      const refundAmount = amount ? Math.round(amount * 100) : payment.amount;

      console.log(`[MOCK] Refund created: ${refundId} for ₹${refundAmount / 100}`);

      return {
        id: refundId,
        entity: 'refund',
        amount: refundAmount,
        currency: payment.currency,
        payment_id: paymentId,
        status: 'processed',
        created_at: Math.floor(Date.now() / 1000),
        _mock: true,
      };
    }

    // REAL MODE
    try {
      const refundData: any = { payment_id: paymentId };
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }
      return await this.razorpay!.payments.refund(paymentId, refundData);
    } catch (error) {
      console.error('Refund creation failed:', error);
      throw new Error('Failed to create refund');
    }
  }

  // Check if running in mock mode
  isMockMode(): boolean {
    return this.mockMode;
  }

  // Get mock order for testing
  getMockOrder(orderId: string): any {
    return mockOrders.get(orderId);
  }
}

export const paymentService = new PaymentService();
