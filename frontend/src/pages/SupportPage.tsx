import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { makeTitle } from '../lib/meta';
import { 
  HelpCircle, 
  FileText, 
  Shield, 
  Info, 
  Mail,
  ChevronRight
} from 'lucide-react';

interface SupportPageProps {
  pageType: 'tos' | 'privacy' | 'ai-disclaimer' | 'faq' | 'about';
}

export default function SupportPage({ pageType }: SupportPageProps) {
  useEffect(() => {
    const pageTitles: Record<string, string> = {
      tos: 'Terms of Service',
      privacy: 'Privacy Policy',
      'ai-disclaimer': 'AI Disclaimer',
      faq: 'FAQ',
      about: 'About'
    };
    const pageTitle = pageTitles[pageType] || 'Support';
    document.title = makeTitle([pageTitle, 'Stone Caster']);
  }, [pageType]);
  const pageContent = {
    tos: {
      title: 'Terms of Service',
      icon: FileText,
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using Stone Caster, you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">2. Use License</h2>
            <p className="text-muted-foreground leading-relaxed">
              Permission is granted to temporarily download one copy of Stone Caster for personal, non-commercial transitory viewing only.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">3. Disclaimer</h2>
            <p className="text-muted-foreground leading-relaxed">
              The materials on Stone Caster are provided on an 'as is' basis. Stone Caster makes no warranties, expressed or implied.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">4. Limitations</h2>
            <p className="text-muted-foreground leading-relaxed">
              In no event shall Stone Caster or its suppliers be liable for any damages arising out of the use or inability to use the materials on Stone Caster.
            </p>
          </section>
        </div>
      )
    },
    privacy: {
      title: 'Privacy Policy',
      icon: Shield,
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information you provide directly to us, such as when you create an account, participate in adventures, or contact us for support.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell, trade, or otherwise transfer your personal information to third parties without your consent, except as described in this policy.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>
        </div>
      )
    },
    'ai-disclaimer': {
      title: 'AI Disclaimer',
      icon: Info,
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">AI-Generated Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              Stone Caster uses artificial intelligence to generate dynamic story content, character interactions, and world events. All AI-generated content is fictional and for entertainment purposes only.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Content Accuracy</h2>
            <p className="text-muted-foreground leading-relaxed">
              While we strive for quality, AI-generated content may occasionally produce unexpected or inappropriate results. We continuously monitor and improve our AI systems.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">User Responsibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              Users are responsible for their interactions with AI-generated content and should report any concerning or inappropriate content through our support channels.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Data Usage</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your game interactions may be used to improve our AI systems, but personal information is never shared with third parties without consent.
            </p>
          </section>
        </div>
      )
    },
    faq: {
      title: 'Frequently Asked Questions',
      icon: HelpCircle,
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">What is Stone Caster?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Stone Caster is an AI-powered interactive storytelling platform where you create characters and embark on dynamic adventures in unique fantasy worlds.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">How do Casting Stones work?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Casting Stones are the in-game currency used to take actions and progress through adventures. They regenerate over time and can be purchased if needed.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Can I play for free?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Yes! Stone Caster offers a free tier with limited characters and adventures. Premium subscriptions unlock unlimited content and exclusive features.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">How do I get an invite?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Stone Caster is currently in invite-only beta. Join our waitlist or check with existing users for invite codes.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Is my data safe?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Absolutely. We use industry-standard encryption and never share your personal information. See our Privacy Policy for full details.
            </p>
          </section>
        </div>
      )
    },
    about: {
      title: 'About Stone Caster',
      icon: Info,
      content: (
        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              Stone Caster aims to revolutionize interactive storytelling by combining AI technology with engaging fantasy worlds, creating unique experiences for every player.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">The Team</h2>
            <p className="text-muted-foreground leading-relaxed">
              We're a passionate team of developers, writers, and AI researchers dedicated to creating the future of interactive entertainment.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Technology</h2>
            <p className="text-muted-foreground leading-relaxed">
              Stone Caster uses cutting-edge AI to generate dynamic, responsive stories that adapt to your choices and create truly personalized adventures.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <div className="space-y-2">
              <p className="text-muted-foreground">Have questions or feedback? We'd love to hear from you!</p>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span className="text-sm">support@stonecaster.com</span>
              </div>
            </div>
          </section>
        </div>
      )
    }
  };

  const currentPage = pageContent[pageType];
  const Icon = currentPage.icon;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-primary mr-3" />
            <h1 className="text-3xl font-bold">{currentPage.title}</h1>
          </div>
          <p className="text-muted-foreground">
            {pageType === 'tos' && 'Terms and conditions for using Stone Caster'}
            {pageType === 'privacy' && 'How we collect, use, and protect your information'}
            {pageType === 'ai-disclaimer' && 'Important information about AI-generated content'}
            {pageType === 'faq' && 'Common questions and answers about Stone Caster'}
            {pageType === 'about' && 'Learn more about Stone Caster and our mission'}
          </p>
        </div>

        {/* Content */}
        <Card>
          <CardContent className="p-8">
            {currentPage.content}
          </CardContent>
        </Card>

        {/* Related Links */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Related Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(pageContent)
                .filter(([key]) => key !== pageType)
                .map(([key, page]) => {
                  const PageIcon = page.icon;
                  return (
                    <Button
                      key={key}
                      variant="outline"
                      className="h-auto p-4 justify-start"
                      onClick={() => {
                        // Navigate to other support pages
                        window.location.href = `/${key}`;
                      }}
                    >
                      <PageIcon className="h-5 w-5 mr-3" />
                      <div className="text-left">
                        <div className="font-medium">{page.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {key === 'tos' && 'Terms and conditions'}
                          {key === 'privacy' && 'Privacy and data protection'}
                          {key === 'ai-disclaimer' && 'AI content information'}
                          {key === 'faq' && 'Frequently asked questions'}
                          {key === 'about' && 'About our platform'}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 ml-auto" />
                    </Button>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
