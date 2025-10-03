import { Link } from 'react-router-dom';

export function GlobalFooter() {
  const footerLinks = [
    { name: 'Terms of Service', href: '/tos' },
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'AI Disclaimer', href: '/ai-disclaimer' },
    { name: 'FAQ', href: '/faq' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <footer id="footer" className="border-t border-border bg-muted/30">
      <div className="container max-w-screen-2xl py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {footerLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.name}
            </Link>
          ))}
        </div>
        <div className="mt-6 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © 2024 StoneCaster. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}


