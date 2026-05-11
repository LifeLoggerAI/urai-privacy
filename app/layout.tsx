import './globals.css'
import { Providers } from './providers'
import { Header } from './components/Header'
import { Footer } from './components/Footer'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main className="p-8">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
