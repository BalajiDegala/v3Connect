import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { MessageCircle, Phone, Mail, Clock, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

export function SupportPage() {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !category || !message) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success('Support ticket submitted successfully! We will get back to you soon.');
    setSubject('');
    setCategory('');
    setMessage('');
  };

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-foreground mb-2">Support</h1>
      <p className="text-muted-foreground mb-8">Get help from our support team</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Submit a Support Ticket</CardTitle>
              <CardDescription>
                Fill out the form below and our team will respond within 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Subject</Label>
                  <Input
                    placeholder="Brief description of your issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="technical">Technical Issue</SelectItem>
                      <SelectItem value="billing">Billing Question</SelectItem>
                      <SelectItem value="account">Account Management</SelectItem>
                      <SelectItem value="feature">Feature Request</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Message</Label>
                  <Textarea
                    placeholder="Describe your issue in detail..."
                    rows={6}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Submit Ticket
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-b pb-4">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">How do I add a new machine?</h3>
                    <p className="text-sm text-muted-foreground">
                      Go to the "Get Quote" page, select your desired configuration, and click
                      "Provision Machines" to add new cloud machines to your account.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">How do I assign a machine to a user?</h3>
                    <p className="text-sm text-muted-foreground">
                      Navigate to the "Machines" page, find a free machine, and click the "Assign"
                      button. Select the user and optionally specify a task.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-b pb-4">
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">What happens when a machine expires?</h3>
                    <p className="text-sm text-muted-foreground">
                      Expired machines are automatically stopped and marked as expired. You can
                      extend them directly from the Machines page using the "Extend" button, which allows
                      you to add additional months to your subscription. Machines expiring within 7 days
                      will show a warning indicator.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <h3 className="font-medium mb-1">How do I apply discount codes?</h3>
                    <p className="text-sm text-muted-foreground">
                      When getting a quote, enter your discount code in the "Discount Code" section
                      and click apply. The discount will be reflected in your total.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium">Phone</p>
                  <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                  <p className="text-xs text-muted-foreground mt-1">Mon-Fri, 9am-6pm EST</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">support@ankiyacloud.com</p>
                  <p className="text-xs text-muted-foreground mt-1">24-hour response time</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="font-medium">Live Chat</p>
                  <p className="text-sm text-muted-foreground">Available 24/7</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Start Chat
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Support Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-600" />
                <div className="text-sm">
                  <p className="font-medium">Business Hours</p>
                  <p className="text-muted-foreground">Mon-Fri: 9am - 6pm EST</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-600" />
                <div className="text-sm">
                  <p className="font-medium">Emergency Support</p>
                  <p className="text-muted-foreground">24/7 for critical issues</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-100 border-gray-300">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-2">Need immediate help?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                For urgent technical issues, contact our emergency hotline
              </p>
              <Button className="w-full" variant="default">
                Call Emergency Support
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
