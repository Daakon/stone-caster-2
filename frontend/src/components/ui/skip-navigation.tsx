import { cn } from '@/lib/utils';

interface SkipNavigationProps {
  links: Array<{
    href: string;
    label: string;
  }>;
  className?: string;
}

export function SkipNavigation({ links, className }: SkipNavigationProps) {
  return (
    <div className={cn('sr-only focus-within:not-sr-only', className)}>
      <nav aria-label="Skip navigation">
        <ul className="flex flex-col gap-2 p-4 bg-background border-b">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-block px-4 py-2 text-sm font-medium text-foreground bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.querySelector(link.href);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    (target as HTMLElement).focus();
                  }
                }}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
