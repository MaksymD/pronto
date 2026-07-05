import { redirect } from 'next/navigation'

// No public marketing landing page for this private deployment —
// anyone hitting "/" goes straight to the login screen.
// (Authenticated users are already redirected to /dashboard by middleware.ts)
export default function Home() {
  redirect('/login')
}