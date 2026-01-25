import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SupportWidget from '@/components/SupportWidget';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Plus,
  Download,
  Smartphone,
  Apple,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  RotateCcw,
  CreditCard,
  Lock,
  Package,
} from 'lucide-react';

interface Build {
  id: string;
  build_id: string;
  app_name: string;
  package_id: string | null;
  platform: string;
  status: string;
  download_url: string | null;
  aab_download_url: string | null;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
}

interface PaymentStatus {
  [buildId: string]: {
    paid: boolean;
    checking: boolean;
  };
}

const DOWNLOAD_FEE_INR = 2800;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingBuildId, setRetryingBuildId] = useState<string | null>(null);
  const [syncingBuildId, setSyncingBuildId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({});
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Check for payment return from Stripe
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentResult = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');
    const buildId = urlParams.get('build_id');

    if (paymentResult === 'success' && sessionId && buildId) {
      toast({
        title: "Payment Successful!",
        description: "You can now download your app files.",
      });
      // Verify and update payment status
      checkPaymentStatus(buildId, sessionId);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentResult === 'cancelled') {
      toast({
        title: "Payment Cancelled",
        description: "You can complete payment anytime to download your app.",
        variant: "destructive",
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchBuilds();

      // Subscribe to realtime updates
      const channel = supabase
        .channel('builds-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'builds',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Real-time build update:', payload);
            fetchBuilds();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Check payment status for all builds
  useEffect(() => {
    if (builds.length > 0) {
      builds.forEach((build) => {
        if (!paymentStatus[build.build_id]) {
          checkPaymentStatus(build.build_id);
        }
      });
    }
  }, [builds]);

  // Auto-sync builds that are queued or building
  useEffect(() => {
    const pendingBuilds = builds.filter(b => 
      ['queued', 'building', 'in_progress'].includes(b.status.toLowerCase())
    );

    if (pendingBuilds.length > 0) {
      const interval = setInterval(() => {
        pendingBuilds.forEach(build => {
          syncBuildStatus(build.build_id, true);
        });
      }, 15000); // Check every 15 seconds

      return () => clearInterval(interval);
    }
  }, [builds]);

  const fetchBuilds = async () => {
    try {
      const { data, error } = await supabase
        .from('builds')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBuilds(data || []);
    } catch (error) {
      console.error('Error fetching builds:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkPaymentStatus = async (buildId: string, sessionId?: string) => {
    setPaymentStatus(prev => ({
      ...prev,
      [buildId]: { ...prev[buildId], checking: true },
    }));

    try {
      const { data, error } = await supabase.functions.invoke('check-payment', {
        body: { buildId, sessionId },
      });

      if (!error) {
        setPaymentStatus(prev => ({
          ...prev,
          [buildId]: { paid: data?.paid === true, checking: false },
        }));
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      setPaymentStatus(prev => ({
        ...prev,
        [buildId]: { ...prev[buildId], checking: false },
      }));
    }
  };

  const syncBuildStatus = async (buildId: string, silent = false) => {
    if (!silent) {
      setSyncingBuildId(buildId);
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-build-status', {
        body: { buildId },
      });

      if (error) {
        console.error('Error syncing build:', error);
        if (!silent) {
          toast({
            title: "Sync Failed",
            description: "Could not sync build status. Please try again.",
            variant: "destructive",
          });
        }
      } else if (data?.success) {
        if (!silent) {
          toast({
            title: "Status Updated",
            description: `Build status: ${data.status}`,
          });
        }
        fetchBuilds();
      }
    } catch (error) {
      console.error('Error syncing build:', error);
    } finally {
      if (!silent) {
        setSyncingBuildId(null);
      }
    }
  };

  const handlePayment = async (build: Build) => {
    setProcessingPayment(build.build_id);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          buildId: build.build_id,
          appName: build.app_name,
          successUrl: `${window.location.origin}/dashboard?payment=success&build_id=${build.build_id}`,
          cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data?.alreadyPaid) {
        setPaymentStatus(prev => ({
          ...prev,
          [build.build_id]: { paid: true, checking: false },
        }));
        toast({
          title: "Already Paid",
          description: "You can download your app now!",
        });
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Failed to get payment URL");
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: "Could not process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(null);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    window.open(url, '_blank');
  };

  const handleRetryBuild = async (build: Build) => {
    if (!build.package_id) {
      toast({
        title: "Cannot retry build",
        description: "Missing package information. Please create a new build.",
        variant: "destructive",
      });
      return;
    }

    setRetryingBuildId(build.id);

    try {
      const response = await supabase.functions.invoke('build-app', {
        body: {
          websiteUrl: '',
          appName: build.app_name,
          packageId: build.package_id,
          platforms: [build.platform],
          userId: user?.id,
          enableNavigation: false,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Build restarted",
        description: `${build.app_name} is being rebuilt for ${build.platform}.`,
      });

      fetchBuilds();
    } catch (error) {
      console.error('Retry build error:', error);
      toast({
        title: "Retry failed",
        description: "Could not restart the build. Please try again or create a new build.",
        variant: "destructive",
      });
    } finally {
      setRetryingBuildId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    switch (normalizedStatus) {
      case 'queued':
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="w-3 h-3" />
            Queued
          </Badge>
        );
      case 'building':
      case 'in_progress':
      case 'preparing':
      case 'fetching':
        return (
          <Badge variant="secondary" className="gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Building
          </Badge>
        );
      case 'finished':
      case 'completed':
      case 'success':
        return (
          <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </Badge>
        );
      case 'failed':
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            {status}
          </Badge>
        );
    }
  };

  const isCompleted = (status: string) => {
    return ['finished', 'completed', 'success'].includes(status.toLowerCase());
  };

  const isFailed = (status: string) => {
    return ['failed', 'error'].includes(status.toLowerCase());
  };

  const isPending = (status: string) => {
    return ['queued', 'building', 'in_progress', 'preparing', 'fetching'].includes(status.toLowerCase());
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">My Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                View and manage your app builds
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
              <Button variant="hero" onClick={() => navigate('/builder')}>
                <Plus className="w-4 h-4 mr-2" />
                Create New App
              </Button>
            </div>
          </div>

          {/* Builds List */}
          {builds.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Smartphone className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No builds yet</h2>
              <p className="text-muted-foreground mb-6">
                Start by creating your first app
              </p>
              <Button variant="hero" onClick={() => navigate('/builder')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First App
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {builds.map((build) => {
                const buildPayment = paymentStatus[build.build_id];
                const isPaid = buildPayment?.paid || false;
                const checkingPaymentStatus = buildPayment?.checking || false;

                return (
                  <div
                    key={build.id}
                    className="glass-card rounded-xl p-6 transition-all hover:shadow-lg"
                  >
                    <div className="flex flex-col gap-4">
                      {/* Build Info Row */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                            {build.platform === 'android' ? (
                              <Smartphone className="w-6 h-6 text-primary" />
                            ) : (
                              <Apple className="w-6 h-6 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{build.app_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-sm text-muted-foreground capitalize">
                                {build.platform}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground">
                                {new Date(build.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                          {getStatusBadge(build.status)}

                          {/* Sync button for pending builds */}
                          {isPending(build.status) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => syncBuildStatus(build.build_id)}
                              disabled={syncingBuildId === build.build_id}
                            >
                              {syncingBuildId === build.build_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Completed Build - Payment & Download Section */}
                      {isCompleted(build.status) && (
                        <div className="border-t pt-4 mt-2">
                          {checkingPaymentStatus ? (
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Checking payment status...</span>
                            </div>
                          ) : isPaid ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-green-600 text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Payment Complete - Downloads Unlocked</span>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {build.platform === 'android' && build.download_url && (
                                  <Button
                                    size="sm"
                                    variant="hero"
                                    onClick={() =>
                                      handleDownload(
                                        build.download_url!,
                                        `${build.app_name}.apk`
                                      )
                                    }
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download APK
                                  </Button>
                                )}
                                {build.platform === 'android' && build.aab_download_url && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleDownload(
                                        build.aab_download_url!,
                                        `${build.app_name}.aab`
                                      )
                                    }
                                  >
                                    <Package className="w-4 h-4 mr-1" />
                                    Download AAB
                                  </Button>
                                )}
                                {build.platform === 'ios' && build.download_url && (
                                  <Button
                                    size="sm"
                                    variant="hero"
                                    onClick={() =>
                                      handleDownload(
                                        build.download_url!,
                                        `${build.app_name}.ipa`
                                      )
                                    }
                                  >
                                    <Download className="w-4 h-4 mr-1" />
                                    Download IPA
                                  </Button>
                                )}
                                {!build.download_url && !build.aab_download_url && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">
                                      Download links pending
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => syncBuildStatus(build.build_id)}
                                      disabled={syncingBuildId === build.build_id}
                                    >
                                      {syncingBuildId === build.build_id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <RefreshCw className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <Lock className="w-5 h-5 text-primary" />
                                  <div>
                                    <p className="font-medium">Downloads Locked</p>
                                    <p className="text-sm text-muted-foreground">
                                      Complete payment to download your app
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-2xl font-bold text-primary">
                                    ₹{DOWNLOAD_FEE_INR.toLocaleString('en-IN')}
                                  </span>
                                  <Button
                                    onClick={() => handlePayment(build)}
                                    disabled={processingPayment === build.build_id}
                                  >
                                    {processingPayment === build.build_id ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                      </>
                                    ) : (
                                      <>
                                        <CreditCard className="w-4 h-4 mr-2" />
                                        Pay Now
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Failed Build - Retry Section */}
                      {isFailed(build.status) && (
                        <div className="border-t pt-4 mt-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <span className="text-sm text-destructive">
                              {build.error_message || 'Build failed'}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetryBuild(build)}
                              disabled={retryingBuildId === build.id}
                            >
                              {retryingBuildId === build.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <RotateCcw className="w-4 h-4 mr-1" />
                              )}
                              Retry Build
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Pending Build - Status Info */}
                      {isPending(build.status) && (
                        <div className="border-t pt-4 mt-2">
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Build in progress. Status updates automatically every 15 seconds.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
      <SupportWidget />
    </div>
  );
};

export default Dashboard;
