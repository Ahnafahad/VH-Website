import { notFound } from 'next/navigation'
import DevLoginForm from './DevLoginForm'

// Hidden dev-only login shortcut. 404s outside development so it is invisible
// and inert if the code ever reaches a production build.
export default function DevLoginPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <DevLoginForm />
}
