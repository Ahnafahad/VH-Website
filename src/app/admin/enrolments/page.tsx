import { redirect } from 'next/navigation';

// Alias: the page keeps its original /admin/registrations route.
export default function EnrolmentsAlias() {
  redirect('/admin/registrations');
}
