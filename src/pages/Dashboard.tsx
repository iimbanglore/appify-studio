import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';

interface Build {
  id: string;
  build_id: string;
  app_name: string;
  platform: string;
  status: string;
  download_url: string | null;
  aab_download_url: string | null;
  created_at: string;
  finished_at: string | null;
  error_message: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

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
          () => {
            fetchBuilds();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

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

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              {builds.map((build) => (
                <div
                  key={build.id}
                  className="glass-card rounded-xl p-6 transition-all hover:shadow-lg"
                >
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

                    <div className="flex items-center gap-4 flex-wrap">
                      {getStatusBadge(build.status)}

                      {['finished', 'completed', 'success'].includes(build.status.toLowerCase()) && (
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
                              <Download className="w-4 h-4 mr-1" />
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
                            <span className="text-sm text-muted-foreground">
                              Build completed - download links pending
                            </span>
                          )}
                        </div>
                      )}

                      {['failed', 'error'].includes(build.status.toLowerCase()) && (
                        <span className="text-sm text-destructive max-w-xs">
                          {build.error_message || 'Build failed - please try again'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
