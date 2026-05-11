import Link from 'next/link'

export function Header() {
  return (
    <header className="p-4 border-b">
      <nav className="flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">URAI Privacy</Link>
        <div className="hidden md:flex items-center space-x-4">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data">Data</Link>
          <Link href="/security">Security</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div className="md:hidden">
          {/* Mobile menu button */}
        </div>
      </nav>
    </header>
  )
}
