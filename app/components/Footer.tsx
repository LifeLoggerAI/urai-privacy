import Link from 'next/link'

export function Footer() {
  return (
    <footer className="p-4 border-t">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} URAI Labs</p>
        <div className="flex items-center space-x-4">
          <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-900">Privacy</Link>
          <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900">Terms</Link>
          <Link href="/data" className="text-sm text-gray-500 hover:text-gray-900">Data</Link>
          <Link href="/security" className="text-sm text-gray-500 hover:text-gray-900">Security</Link>
          <Link href="/cookies" className="text-sm text-gray-500 hover:text-gray-900">Cookies</Link>
          <Link href="/contact" className="text-sm text-gray-500 hover:text-gray-900">Contact</Link>
        </div>
      </div>
    </footer>
  )
}
