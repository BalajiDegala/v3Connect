import { useState, useEffect } from 'react';
import { PageLayout } from '../components/PageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Plus, Trash2, Tag, Loader2, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

// Razorpay types
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface MachineConfig {
  id: string;
  name: string;
  cpu: string;
  ram: string;
  storage: string;
  gpu: string | null;
  pricePerMonth: number;
}

interface MachineSpec {
  id: string;
  configId: string;
  name: string;
  cpu: string;
  ram: string;
  storage: string;
  gpu: string | null;
  quantity: number;
  price: number;
}

interface OrderResult {
  orderId: string;
  orderNumber: string;
  status: 'success' | 'pending' | 'failed';
  ticketNumber?: string;
  error?: string;
}

// Fallback machine types if API fails
const fallbackMachineTypes: MachineConfig[] = [
  { id: '1', name: 'Basic', cpu: '2 vCPU', ram: '4 GB', storage: '100 GB SSD', gpu: null, pricePerMonth: 16660 },
  { id: '2', name: 'Standard', cpu: '4 vCPU', ram: '8 GB', storage: '200 GB SSD', gpu: null, pricePerMonth: 33320 },
  { id: '3', name: 'Pro', cpu: '4 vCPU', ram: '16 GB', storage: '250 GB SSD', gpu: null, pricePerMonth: 49980 },
  { id: '4', name: 'Power', cpu: '6 vCPU', ram: '24 GB', storage: '300 GB SSD', gpu: null, pricePerMonth: 74970 },
  { id: '5', name: 'VFX', cpu: '8 vCPU', ram: '32 GB', storage: '500 GB SSD', gpu: 'NVIDIA RTX 4080', pricePerMonth: 99960 },
  { id: '6', name: 'VFX Pro', cpu: '16 vCPU', ram: '64 GB', storage: '1 TB SSD', gpu: 'NVIDIA RTX 4090 x2', pricePerMonth: 199920 },
];

const API_BASE_URL = 'http://localhost:5000/api';

export function QuotePage() {
  const { isAuthenticated, user, login, token } = useAuth();
  const navigate = useNavigate();
  const [machineConfigs, setMachineConfigs] = useState<MachineConfig[]>([]);
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true);
  const [machines, setMachines] = useState<MachineSpec[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [duration, setDuration] = useState<number>(1); // months
  const [discountCode, setDiscountCode] = useState<string>('');
  const [discount, setDiscount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMockMode, setPaymentMockMode] = useState(true); // Default to mock mode
  
  // Order completion dialog
  const [orderResults, setOrderResults] = useState<OrderResult[]>([]);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [processingOrderIndex, setProcessingOrderIndex] = useState(-1);

  // Fetch config (payment mode) on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/config`);
        if (response.ok) {
          const config = await response.json();
          setPaymentMockMode(config.payment?.mockMode ?? true);
        }
      } catch (error) {
        console.error('Error fetching config:', error);
        // Default to mock mode on error
        setPaymentMockMode(true);
      }
    };
    fetchConfig();
  }, []);

  // Fetch machine configurations from API
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/machines/catalog`);
        if (response.ok) {
          const configs = await response.json();
          setMachineConfigs(configs.length > 0 ? configs : fallbackMachineTypes);
        } else {
          console.warn('Failed to fetch machine configs, using fallback');
          setMachineConfigs(fallbackMachineTypes);
        }
      } catch (error) {
        console.error('Error fetching machine configs:', error);
        setMachineConfigs(fallbackMachineTypes);
      } finally {
        setIsLoadingConfigs(false);
      }
    };

    fetchConfigs();
  }, []);

  const addMachine = () => {
    if (!selectedConfig) {
      toast.error('Please select a machine configuration');
      return;
    }

    const config = machineConfigs.find(c => c.id === selectedConfig);
    if (!config) {
      toast.error('Invalid configuration selected');
      return;
    }

    const newMachine: MachineSpec = {
      id: Date.now().toString(),
      configId: config.id,
      name: config.name,
      cpu: config.cpu,
      ram: config.ram,
      storage: config.storage,
      gpu: config.gpu,
      quantity: quantity,
      price: Number(config.pricePerMonth),
    };

    setMachines([...machines, newMachine]);
    setSelectedConfig('');
    setQuantity(1);
    toast.success('Machine added to quote');
  };

  const removeMachine = (id: string) => {
    setMachines(machines.filter((m) => m.id !== id));
    toast.success('Machine removed from quote');
  };

  const applyDiscount = () => {
    if (discountCode === 'WELCOME10') {
      setDiscount(10);
      toast.success('Discount code applied: 10% off');
    } else if (discountCode === 'SAVE20') {
      setDiscount(20);
      toast.success('Discount code applied: 20% off');
    } else {
      toast.error('Invalid discount code');
    }
  };

  const subtotal = machines.reduce((sum, m) => sum + m.price * m.quantity * duration, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  const handleGetMachines = async () => {
    if (machines.length === 0) {
      toast.error('Please add at least one machine to your quote');
      return;
    }

    // User must be logged in to order
    if (!isAuthenticated) {
      toast.info('Please sign in to submit your order');
      login();
      return;
    }

    // User must have an organization
    if (!user?.organizationId) {
      toast.error('Please complete your organization setup first. Go to Settings to create your organization.');
      return;
    }

    setIsSubmitting(true);
    setOrderResults([]);
    setShowResultDialog(true);
    
    try {
      // Get fresh token from Keycloak
      const freshToken = await new Promise<string>((resolve, reject) => {
        import('../contexts/AuthContext').then(module => {
          const keycloak = module.default;
          keycloak.updateToken(30).then(() => {
            resolve(keycloak.token || '');
          }).catch(reject);
        });
      });

      // Process each machine type
      for (let i = 0; i < machines.length; i++) {
        const machine = machines[i];
        setProcessingOrderIndex(i);
        
        try {
          // Create order
          const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${freshToken}`,
            },
            body: JSON.stringify({
              machineConfigId: machine.configId,
              quantity: machine.quantity,
              duration: duration,
            }),
          });

          if (!orderResponse.ok) {
            const error = await orderResponse.json();
            throw new Error(error.error || 'Failed to create order');
          }

          const { order, razorpayOrder } = await orderResponse.json();
          
          // Open Razorpay checkout
          const paymentResult = await openRazorpayCheckout(
            razorpayOrder,
            order,
            freshToken
          );
          
          setOrderResults(prev => [...prev, paymentResult]);
          
        } catch (error) {
          setOrderResults(prev => [...prev, {
            orderId: '',
            orderNumber: `Machine ${i + 1}`,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Payment failed',
          }]);
        }
      }

      // Clear cart on success
      const allSuccess = orderResults.every(r => r.status === 'success');
      if (allSuccess) {
        setMachines([]);
        setDiscount(0);
        setDiscountCode('');
        setDuration(1);
      }
      
    } catch (error) {
      console.error('Order submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
      setProcessingOrderIndex(-1);
    }
  };
  
  const openRazorpayCheckout = (
    razorpayOrder: { id: string; amount: number; currency: string },
    order: any,
    authToken: string
  ): Promise<OrderResult> => {
    return new Promise((resolve) => {
      const options = {
        key: 'rzp_test_mock', // Mock key for development
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        name: 'Ankiya Cloud',
        description: `${order.machineConfig?.name || 'Machine'} x${order.quantity}`,
        order_id: razorpayOrder.id,
        handler: async function (response: any) {
          try {
            // Verify payment with backend
            const verifyResponse = await fetch(`${API_BASE_URL}/orders/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            if (verifyResponse.ok) {
              const result = await verifyResponse.json();
              resolve({
                orderId: order.id,
                orderNumber: order.orderNumber,
                status: 'success',
                ticketNumber: result.ticket?.ticketNumber,
              });
            } else {
              resolve({
                orderId: order.id,
                orderNumber: order.orderNumber,
                status: 'failed',
                error: 'Payment verification failed',
              });
            }
          } catch (error) {
            resolve({
              orderId: order.id,
              orderNumber: order.orderNumber,
              status: 'failed',
              error: 'Payment verification error',
            });
          }
        },
        modal: {
          ondismiss: function() {
            resolve({
              orderId: order.id,
              orderNumber: order.orderNumber,
              status: 'pending',
              error: 'Payment cancelled',
            });
          }
        },
        prefill: {
          email: user?.email || '',
          contact: '',
        },
        theme: {
          color: '#667eea'
        }
      };

      // Use mock payment if mock mode is enabled, otherwise use Razorpay
      if (paymentMockMode) {
        // Mock payment for development
        console.log('Using mock payment (mock mode enabled)');
        mockPayment(razorpayOrder, order, authToken).then(resolve);
      } else if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback to mock payment if Razorpay not available
        console.log('Razorpay not available, falling back to mock payment');
        mockPayment(razorpayOrder, order, authToken).then(resolve);
      }
    });
  };
  
  const mockPayment = async (
    razorpayOrder: { id: string; amount: number; currency: string },
    order: any,
    authToken: string
  ): Promise<OrderResult> => {
    // Simulate payment delay
    await new Promise(r => setTimeout(r, 1500));
    
    try {
      // Call mock payment complete endpoint
      const mockResponse = await fetch(`${API_BASE_URL}/mock-payment/${razorpayOrder.id}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          success: true,
        }),
      });

      if (mockResponse.ok) {
        const mockResult = await mockResponse.json();
        
        // Now verify with our backend
        const verifyResponse = await fetch(`${API_BASE_URL}/orders/verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            orderId: mockResult.razorpay_order_id,
            paymentId: mockResult.razorpay_payment_id,
            signature: mockResult.razorpay_signature,
          }),
        });

        if (verifyResponse.ok) {
          const result = await verifyResponse.json();
          return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: 'success',
            ticketNumber: result.ticket?.ticketNumber,
          };
        }
      }
      
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'failed',
        error: 'Mock payment failed',
      };
    } catch (error) {
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: 'failed',
        error: 'Mock payment error',
      };
    }
  };

  return (
    <PageLayout>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-2">Get a Quote</h1>
      <p className="text-muted-foreground mb-8">Configure your cloud infrastructure and get instant pricing</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Machine Configuration</CardTitle>
              <CardDescription>Select machine specifications and quantity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Machine Type</Label>
                {isLoadingConfigs ? (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading configurations...
                  </div>
                ) : (
                  <Select value={selectedConfig} onValueChange={setSelectedConfig}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select configuration" />
                    </SelectTrigger>
                    <SelectContent>
                      {machineConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{config.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {config.cpu} • {config.ram} • {config.storage}
                              {config.gpu && ` • ${config.gpu}`}
                              {' - '}₹{Number(config.pricePerMonth).toLocaleString()}/mo
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                />
              </div>

              <div>
                <Label>Duration (months)</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 month</SelectItem>
                    <SelectItem value="3">3 months (5% off)</SelectItem>
                    <SelectItem value="6">6 months (10% off)</SelectItem>
                    <SelectItem value="12">12 months (20% off)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={addMachine} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add to Quote
              </Button>
            </CardContent>
          </Card>

          {machines.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Selected Machines</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {machines.map((machine) => (
                    <div
                      key={machine.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{machine.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {machine.cpu} • {machine.ram} • {machine.storage}
                          {machine.gpu && ` • ${machine.gpu}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {machine.quantity} × ₹{machine.price.toLocaleString()}/month
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold">
                          ₹{(machine.price * machine.quantity).toLocaleString()}/mo
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMachine(machine.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Discount Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Enter Code</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., WELCOME10"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                  />
                  <Button onClick={applyDiscount} variant="outline">
                    <Tag className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {discount > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">{discount}% discount applied!</p>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                <p>Try these codes:</p>
                <p>• WELCOME10 (10% off)</p>
                <p>• SAVE20 (20% off)</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Price Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span>{duration} month{duration > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount ({discount}%)</span>
                  <span>-₹{discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t pt-3 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {machines.length > 0 && `(₹${Math.round(total / duration).toLocaleString()}/month for ${duration} month${duration > 1 ? 's' : ''})`}
              </p>
              
              {!isAuthenticated && (
                <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                  Sign in to submit your order
                </p>
              )}
              
              <Button 
                onClick={handleGetMachines} 
                className="w-full" 
                size="lg"
                disabled={isSubmitting || machines.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : isAuthenticated ? (
                  'Provision Machines'
                ) : (
                  'Sign In & Order'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Order Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isSubmitting ? 'Processing Orders' : 'Order Summary'}
            </DialogTitle>
            <DialogDescription>
              {isSubmitting 
                ? `Processing order ${processingOrderIndex + 1} of ${machines.length}...` 
                : 'Your order results'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {orderResults.map((result, index) => (
              <div 
                key={index} 
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  result.status === 'success' 
                    ? 'bg-green-50 border-green-200' 
                    : result.status === 'pending'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {result.status === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : result.status === 'pending' ? (
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{result.orderNumber}</p>
                  {result.ticketNumber && (
                    <p className="text-sm text-green-700">
                      Ticket: {result.ticketNumber}
                    </p>
                  )}
                  {result.error && (
                    <p className="text-sm text-red-600">{result.error}</p>
                  )}
                </div>
              </div>
            ))}
            
            {isSubmitting && processingOrderIndex >= 0 && processingOrderIndex < machines.length && (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-gray-100 border-gray-300">
                <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                <div className="flex-1">
                  <p className="font-medium">
                    {machines[processingOrderIndex]?.name} x{machines[processingOrderIndex]?.quantity}
                  </p>
                  <p className="text-sm text-gray-600">Processing payment...</p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="flex gap-2">
            {!isSubmitting && orderResults.some(r => r.status === 'success') && (
              <Button onClick={() => navigate('/machines')} className="flex-1">
                View Machines
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => setShowResultDialog(false)}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Please wait...' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </PageLayout>
  );
}
