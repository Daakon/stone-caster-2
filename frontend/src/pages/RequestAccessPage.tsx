/**
 * Request Access Page
 * Phase B5: Public form for submitting Early Access requests
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { publicAccessRequestsService } from '@/services/accessRequests';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';

const requestSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  note: z.string().max(500, 'Note too long').optional(),
  newsletter: z.boolean().optional(),
  honeypot: z.string().optional(), // Bot detection
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function RequestAccessPage() {
  const { user } = useAuthStore();
  const [submitted, setSubmitted] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'pending' | 'approved' | 'denied' | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      email: user?.email || '',
      newsletter: false,
      honeypot: '',
    },
  });

  // Poll for status if user is authenticated
  const { data: statusData } = useQuery({
    queryKey: ['access-request-status'],
    queryFn: () => publicAccessRequestsService.getStatus(),
    enabled: !!user,
    refetchInterval: (data) => {
      // Only poll if status is pending, stop polling once approved/denied or no request
      const status = data?.data?.request?.status;
      if (status === 'pending') {
        return 10000; // Poll every 10s
      }
      // Stop polling if approved, denied, or no request
      return false;
    },
  });

  useEffect(() => {
    if (statusData?.ok && statusData.data?.request) {
      const status = statusData.data.request.status;
      setRequestStatus(status);
      setHasPendingRequest(status === 'pending');
      
      // If approved, show success message
      if (status === 'approved') {
        toast.success('Your Early Access request has been approved!');
      }
    } else if (statusData?.ok && !statusData.data?.request) {
      setHasPendingRequest(false);
      setRequestStatus(null);
    }
  }, [statusData]);

  const onSubmit = async (data: RequestFormData) => {
    // Honeypot check
    if (data.honeypot) {
      toast.error('Bot detected');
      return;
    }

    try {
      const result = await publicAccessRequestsService.submit({
        email: data.email,
        note: data.note,
        newsletter: data.newsletter,
      });

      if (result.ok) {
        setSubmitted(true);
        setRequestStatus('pending');
        toast.success('Request submitted successfully!');
        reset();
      } else {
        if (result.code === 'RATE_LIMITED') {
          toast.error(result.message || 'Too many requests. Please try again later.');
        } else {
          toast.error(result.message || 'Failed to submit request');
        }
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request. Please try again.');
    }
  };

  // Show status badge if user is authenticated and has a request
  const showStatusBadge = user && (requestStatus || statusData?.data?.request);

  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Request Early Access</CardTitle>
          <CardDescription>
            StoneCaster is currently in Early Access. Request access to start playing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showStatusBadge && (
            <Alert className="mb-6">
              <Mail className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center gap-2">
                  <span>Your request status:</span>
                  <Badge
                    variant={
                      requestStatus === 'approved'
                        ? 'default'
                        : requestStatus === 'denied'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {requestStatus || statusData?.data?.request?.status || 'pending'}
                  </Badge>
                  {requestStatus === 'pending' && (
                    <span className="text-sm text-muted-foreground">
                      (Checking for updates...)
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {submitted || hasPendingRequest ? (
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>
                    {submitted
                      ? 'Request submitted!'
                      : hasPendingRequest
                        ? 'Request already submitted'
                        : 'Request submitted!'}
                  </strong>{' '}
                  {submitted || hasPendingRequest
                    ? "We'll review your request and email you when approved."
                    : 'We\'ll review your request and email you when approved.'}
                </AlertDescription>
              </Alert>
              {submitted && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitted(false);
                    reset();
                  }}
                >
                  Submit Another Request
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email')}
                  disabled={isSubmitting}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Why are you interested? (Optional)</Label>
                <Textarea
                  id="note"
                  {...register('note')}
                  disabled={isSubmitting}
                  placeholder="Tell us why you'd like early access..."
                  rows={4}
                  maxLength={500}
                />
                {errors.note && (
                  <p className="text-sm text-destructive">{errors.note.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {watch('note')?.length || 0}/500 characters
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox id="newsletter" {...register('newsletter')} disabled={isSubmitting} />
                <Label
                  htmlFor="newsletter"
                  className="text-sm font-normal cursor-pointer"
                >
                  Subscribe to our newsletter for updates and news
                </Label>
              </div>

              {/* Honeypot field (hidden) */}
              <div className="hidden">
                <Label htmlFor="honeypot">Leave this field empty</Label>
                <Input id="honeypot" type="text" {...register('honeypot')} tabIndex={-1} />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to our Terms of Service and Privacy Policy. We'll email you
                when your request is reviewed.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

