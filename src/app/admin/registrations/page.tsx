'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Edit2,
  Save,
  X,
  UserPlus,
  Shield,
  RefreshCw,
  Search,
  Filter,
  MessageCircle,
  Sparkles,
  Mail,
  AlertCircle
} from 'lucide-react';
import {
  RED,
  RED_DARK,
  BORDER,
  MUTED,
  BG,
  SURFACE,
  SURFACE_ALT,
  SURFACE_SHELL,
  INK_SOFT,
  OK,
  OK_BG,
  WARN,
  WARN_BG,
  INFO,
  INFO_BG,
  T_XS,
  T_2XL,
  R_MD,
  R_LG,
  R_XL,
  R_2XL,
  R_PILL,
  SHADOW_SM,
  SHADOW_MD,
  SHADOW_LG,
  Modal,
} from '@/components/admin/lms/lms-shared';

type Registration = {
  id: number;
  name: string;
  email: string;
  phone: string;
  educationType: 'hsc' | 'alevels';
  // flat year columns from Drizzle (snake_case → camelCase)
  hscYear?: number | null;
  sscYear?: number | null;
  aLevelYear?: number | null;
  oLevelYear?: number | null;
  programMode: 'mocks' | 'full';
  selectedMocks?: string | null;       // JSON string in DB
  selectedFullCourses?: string | null; // JSON string in DB
  mockIntent?: 'trial' | 'full' | null;
  pricingSubtotal?: number;
  pricingDiscount?: number;
  pricingFinalPrice?: number;
  referralName?: string | null;
  referralInstitution?: string | null;
  referralBatch?: string | null;
  status: 'pending' | 'contacted' | 'enrolled' | 'cancelled';
  studentEmailStatus?: 'sent' | 'failed' | null;
  adminEmailStatus?: 'sent' | 'failed' | null;
  createdAt: string;
};

type Student = {
  studentId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  active: boolean;
  class?: string;
  batch?: string;
};

type FreeSignup = {
  id: number;
  userId: number | null;
  name: string;
  email: string;
  whatsapp: string;
  createdAt: string | number;
};

export default function AdminRegistrationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'registrations' | 'students' | 'freeSignups'>('registrations');
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [freeSignups, setFreeSignups] = useState<FreeSignup[]>([]);
  const [batches, setBatches] = useState<{ id: number; name: string; product: string }[]>([]);
  const [counts, setCounts] = useState({ pending: 0, contacted: 0, enrolled: 0, cancelled: 0 });
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});

  // Grant access modal
  const [showGrantAccessModal, setShowGrantAccessModal] = useState(false);
  const [grantAccessData, setGrantAccessData] = useState<any>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load registrations
      const regRes = await fetch('/api/registrations');
      if (!regRes.ok) throw new Error('Failed to load registrations');
      const regData = await regRes.json();
      setRegistrations(regData.registrations || []);
      setCounts(regData.counts || { pending: 0, contacted: 0, enrolled: 0, cancelled: 0 });

      // Load students from access control
      const studentsRes = await fetch('/api/admin/students');
      if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        setStudents(studentsData.students || []);
      }

      // Load free signups
      const freeRes = await fetch('/api/registrations/games');
      if (freeRes.ok) {
        const freeData = await freeRes.json();
        setFreeSignups(freeData.freeSignups || []);
      }

      // Load batches for the batch dropdowns (degrades to empty list if unavailable)
      const batchesRes = await fetch('/api/admin/batches');
      if (batchesRes.ok) {
        const batchesData = await batchesRes.json();
        setBatches(batchesData.batches || []);
      }

      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const updateRegistrationStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/registrations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update status');

      await loadData();
      alert('Status updated successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const startEditing = (id: string, data: any) => {
    setEditingId(id);
    setEditData({ ...data });
  };

  const saveEdit = async () => {
    if (!editingId) return;

    try {
      const res = await fetch(`/api/registrations/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });

      if (!res.ok) throw new Error('Failed to save changes');

      setEditingId(null);
      setEditData({});
      await loadData();
      alert('Changes saved successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const openGrantAccessModal = (registration: Registration) => {
    setGrantAccessData({
      registrationId: registration.id,
      name: registration.name,
      email: registration.email,
      studentId: '',
      class: '',
      batch: '',
      permissions: ['read']
    });
    setShowGrantAccessModal(true);
  };

  const grantAccess = async () => {
    try {
      const res = await fetch('/api/admin/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grantAccessData)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to grant access');
      }

      setShowGrantAccessModal(false);
      setGrantAccessData({});
      await loadData();
      alert('Access granted successfully! Access control file has been updated.');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const updateStudent = async (studentId: string, updates: any) => {
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, ...updates })
      });

      if (!res.ok) throw new Error('Failed to update student');

      await loadData();
      alert('Student updated successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesStatus = statusFilter === 'all' || reg.status === statusFilter;
    const matchesSearch = reg.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          reg.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCourse = courseFilter === 'all' ||
      (reg.programMode === 'mocks' && (() => {
        try { return JSON.parse(reg.selectedMocks as string); } catch { return []; }
      })().includes(courseFilter)) ||
      (reg.programMode === 'full' && (() => {
        try { return JSON.parse(reg.selectedFullCourses as string); } catch { return []; }
      })().includes(courseFilter));
    return matchesStatus && matchesSearch && matchesCourse;
  });

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFreeSignups = freeSignups.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.whatsapp.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: RED }} />
          <p style={{ color: MUTED }}>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="text-center p-8 max-w-md" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_2XL, boxShadow: SHADOW_LG }}>
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-6 py-2 bg-vh-red text-white rounded-lg hover:bg-vh-dark-red transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: BG }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">Admin Panel</h1>
              <p className="text-gray-600">Manage registrations and student access</p>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {/* Stats band */}
          <div
            className="vh-stat-band mb-6"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', border: `1px solid ${BORDER}`, borderRadius: R_LG, overflow: 'hidden' }}
          >
            {[
              { label: 'Pending', value: counts.pending, icon: Clock },
              { label: 'Contacted', value: counts.contacted, icon: Users },
              { label: 'Enrolled', value: counts.enrolled, icon: CheckCircle },
              { label: 'Active Students', value: students.length, icon: Shield },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="vh-stat-col"
                  style={{ padding: '16px 18px', background: SURFACE, borderLeft: index === 0 ? 'none' : `1px solid ${BORDER}` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <Icon size={14} style={{ color: MUTED }} aria-hidden />
                    <span style={{ fontSize: T_XS, fontWeight: 600, color: MUTED, letterSpacing: '0.02em' }}>{item.label}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: T_2XL, fontWeight: 700, color: INK_SOFT, lineHeight: 1, letterSpacing: '-0.02em' }}>{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="overflow-hidden" style={{ background: SURFACE, borderRadius: R_2XL, boxShadow: SHADOW_MD, border: `1px solid ${BORDER}` }}>
          <div style={{ borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex">
              <button
                onClick={() => setActiveTab('registrations')}
                className={`flex-1 px-6 py-4 font-bold text-lg transition-colors ${
                  activeTab === 'registrations'
                    ? 'bg-vh-red text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users className="w-5 h-5 inline-block mr-2" />
                Registrations ({registrations.length})
              </button>
              <button
                onClick={() => setActiveTab('freeSignups')}
                className={`flex-1 px-6 py-4 font-bold text-lg transition-colors ${
                  activeTab === 'freeSignups'
                    ? 'bg-vh-red text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Sparkles className="w-5 h-5 inline-block mr-2" />
                Free Signups ({freeSignups.length})
              </button>
              <button
                onClick={() => setActiveTab('students')}
                className={`flex-1 px-6 py-4 font-bold text-lg transition-colors ${
                  activeTab === 'students'
                    ? 'bg-vh-red text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Shield className="w-5 h-5 inline-block mr-2" />
                Active Students ({students.length})
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="p-6" style={{ background: SURFACE_SHELL, borderBottom: `1px solid ${BORDER}` }}>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
                />
              </div>
              {activeTab === 'registrations' && (
                <>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="pl-10 pr-8 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all bg-white"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="contacted">Contacted</option>
                      <option value="enrolled">Enrolled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      className="pl-10 pr-8 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all bg-white"
                    >
                      <option value="all">All Courses</option>
                      <optgroup label="Mock Programs">
                        <option value="du-iba">DU IBA</option>
                        <option value="bup-iba">BUP IBA</option>
                        <option value="du-fbs">DU FBS</option>
                        <option value="bup-fbs">BUP FBS</option>
                      </optgroup>
                      <optgroup label="Full Courses">
                        <option value="iba-combined">IBA Combined</option>
                        <option value="du-fbs-full">DU FBS Full</option>
                        <option value="bup-fbs-full">BUP FBS Full</option>
                      </optgroup>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {activeTab === 'registrations' && (
              <div className="space-y-4">
                {filteredRegistrations.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No registrations found</p>
                  </div>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <RegistrationCard
                      key={reg.id}
                      registration={reg}
                      editingId={editingId}
                      editData={editData}
                      onStartEdit={startEditing}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onUpdateStatus={updateRegistrationStatus}
                      onGrantAccess={openGrantAccessModal}
                      setEditData={setEditData}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'freeSignups' && (
              <div className="space-y-4">
                {filteredFreeSignups.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No free signups yet</p>
                  </div>
                ) : (
                  filteredFreeSignups.map((s) => (
                    <FreeSignupCard key={s.id} signup={s} />
                  ))
                )}
              </div>
            )}

            {activeTab === 'students' && (
              <div className="space-y-4">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>No active students found</p>
                  </div>
                ) : (
                  filteredStudents.map((student) => (
                    <StudentCard
                      key={student.studentId}
                      student={student}
                      batches={batches}
                      onUpdate={updateStudent}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grant Access Modal */}
      <GrantAccessModal
        open={showGrantAccessModal}
        data={grantAccessData}
        batches={batches}
        onClose={() => setShowGrantAccessModal(false)}
        onGrant={grantAccess}
        setData={setGrantAccessData}
      />
    </div>
  );
}

// Component for registration card
function EmailStatusBadge({ label, status }: { label: string; status?: 'sent' | 'failed' | null }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold" style={{ background: OK_BG, color: OK, border: `1px solid ${OK}33`, borderRadius: R_PILL }}>
        <CheckCircle className="w-3 h-3" />
        {label}: Sent
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold" style={{ background: `${RED}14`, color: RED_DARK, border: `1px solid ${RED}33`, borderRadius: R_PILL }}>
        <AlertCircle className="w-3 h-3" />
        {label}: Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold" style={{ background: WARN_BG, color: WARN, border: `1px solid ${WARN}33`, borderRadius: R_PILL }}>
      <Clock className="w-3 h-3" />
      {label}: Pending
    </span>
  );
}

function RegistrationCard({ registration, editingId, editData, onStartEdit, onSaveEdit, onCancelEdit, onUpdateStatus, onGrantAccess, setEditData }: any) {
  const reg = registration;
  const isEditing = editingId === reg.id;

  if (isEditing) {
    return (
      <div className="p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_XL }}>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">Edit Registration</h3>
            <div className="flex gap-2">
              <button
                onClick={onSaveEdit}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={editData.name || ''}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
              <select
                value={editData.status || ''}
                onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none bg-white"
              >
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="enrolled">Enrolled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 transition-all" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_XL, boxShadow: SHADOW_SM }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">{reg.name}</h3>
            <span
              className="px-3 py-1 text-xs font-bold"
              style={{
                borderRadius: R_PILL,
                background: reg.status === 'pending' ? WARN_BG : reg.status === 'contacted' ? INFO_BG : reg.status === 'enrolled' ? OK_BG : SURFACE_ALT,
                color: reg.status === 'pending' ? WARN : reg.status === 'contacted' ? INFO : reg.status === 'enrolled' ? OK : MUTED,
              }}
            >
              {reg.status.toUpperCase()}
            </span>
          </div>
          <p className="text-gray-600">{reg.email} • {reg.phone}</p>
          <p className="text-sm text-gray-500 mt-1">
            Registered: {new Date(reg.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onStartEdit(reg.id, reg)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Email Log */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mr-1">Email log</span>
        <EmailStatusBadge label="Student" status={reg.studentEmailStatus} />
        <EmailStatusBadge label="Admin" status={reg.adminEmailStatus} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 mb-2">Educational Background</p>
          <p className="text-gray-900">
            <strong>{reg.educationType === 'hsc' ? 'HSC Track' : 'A Levels Track'}</strong>
          </p>
          {reg.educationType === 'hsc' ? (
            <p className="text-sm text-gray-600 mt-1">
              SSC: {reg.sscYear ?? '—'}, HSC: {reg.hscYear ?? '—'}
            </p>
          ) : (
            <p className="text-sm text-gray-600 mt-1">
              O Level: {reg.oLevelYear ?? '—'}, A Level: {reg.aLevelYear ?? '—'}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <p className="text-sm font-semibold text-gray-500 mb-2">Program Type</p>
          <p className="text-gray-900">
            <strong>{reg.programMode === 'mocks' ? 'Mock Test Programs' : 'Full Courses'}</strong>
          </p>
          {reg.programMode === 'mocks' && (
            <p className="text-sm text-gray-600 mt-1">
              Intent: {reg.mockIntent === 'trial' ? 'Trial First' : 'Full Registration'}
            </p>
          )}
        </div>
      </div>

      {/* Program Details */}
      {reg.programMode === 'mocks' && reg.selectedMocks && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Selected Mock Programs:</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            {(() => {
              try { return JSON.parse(reg.selectedMocks as string); } catch { return []; }
            })().map((mock: string, idx: number) => (
              <li key={idx}>{mock.replace(/-/g, ' ').toUpperCase()}</li>
            ))}
          </ul>
          {reg.pricingSubtotal != null && (
            <div className="mt-3 pt-3 border-t border-blue-300">
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Subtotal:</span>
                <span className="font-bold text-blue-900">Tk {(reg.pricingSubtotal ?? 0).toLocaleString()}</span>
              </div>
              {(reg.pricingDiscount ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Discount:</span>
                  <span className="font-bold text-green-600">- Tk {(reg.pricingDiscount ?? 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-base mt-1 pt-1 border-t border-blue-300">
                <span className="font-bold text-blue-900">Total:</span>
                <span className="font-black text-blue-900">Tk {(reg.pricingFinalPrice ?? 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {reg.programMode === 'full' && reg.selectedFullCourses && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mb-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">Selected Full Course(s):</p>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            {(() => {
              try { return JSON.parse(reg.selectedFullCourses as string); } catch { return []; }
            })().map((course: string, idx: number) => (
              <li key={idx}>{course.replace(/-/g, ' ').toUpperCase()}</li>
            ))}
          </ul>
          {(reg.pricingFinalPrice ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-300 flex justify-between text-base">
              <span className="font-bold text-blue-900">Fees due:</span>
              <span className="font-black text-blue-900">Tk {(reg.pricingFinalPrice ?? 0).toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Referral Information */}
      {reg.referralName && (
        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 mb-4">
          <p className="text-sm font-semibold text-purple-900 mb-2">Referred By:</p>
          <div className="text-sm text-purple-800 space-y-1">
            <p><strong>Name:</strong> {reg.referralName}</p>
            <p><strong>Institution:</strong> {reg.referralInstitution}</p>
            <p><strong>Batch:</strong> {reg.referralBatch}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
        <button
          onClick={() => onUpdateStatus(reg.id, 'contacted')}
          disabled={reg.status === 'contacted'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Users className="w-4 h-4" />
          Mark Contacted
        </button>
        <button
          onClick={() => onUpdateStatus(reg.id, 'enrolled')}
          disabled={reg.status === 'enrolled'}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          Mark Enrolled
        </button>
        <button
          onClick={() => onGrantAccess(reg)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Grant System Access
        </button>
        <button
          onClick={() => onUpdateStatus(reg.id, 'cancelled')}
          disabled={reg.status === 'cancelled'}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// Component for student card
function StudentCard({ student, batches, onUpdate }: any) {
  const batchOptions: string[] = Array.from(new Set<string>((batches || []).map((b: any) => b.name as string))).sort();
  return (
    <div className="p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_XL, boxShadow: SHADOW_SM }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">{student.name}</h3>
            <span
              className="px-3 py-1 text-xs font-bold"
              style={{ borderRadius: R_PILL, background: student.active ? OK_BG : SURFACE_ALT, color: student.active ? OK : MUTED }}
            >
              {student.active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <p className="text-gray-600">{student.email}</p>
          <p className="text-sm text-gray-500 mt-1">
            Student ID: {student.studentId} • Role: {student.role}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Class</p>
          <input
            type="text"
            defaultValue={student.class || ''}
            onBlur={(e) => {
              if (e.target.value !== student.class) {
                onUpdate(student.studentId, { class: e.target.value });
              }
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-vh-red focus:ring-1 focus:ring-vh-red/20 outline-none"
            placeholder="e.g., DU-FBS"
          />
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Batch</p>
          <select
            defaultValue={student.batch || ''}
            onChange={(e) => {
              if (e.target.value !== student.batch) {
                onUpdate(student.studentId, { batch: e.target.value });
              }
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-vh-red focus:ring-1 focus:ring-vh-red/20 outline-none bg-white"
          >
            <option value="">— none —</option>
            {batchOptions.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">Status</p>
          <select
            defaultValue={student.active ? 'active' : 'inactive'}
            onChange={(e) => {
              onUpdate(student.studentId, { active: e.target.value === 'active' });
            }}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-vh-red focus:ring-1 focus:ring-vh-red/20 outline-none bg-white"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 mb-2">Permissions</p>
        <div className="flex flex-wrap gap-2">
          {['read', 'write', 'admin', 'manage_users'].map((perm) => (
            <label key={perm} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={student.permissions.includes(perm)}
                onChange={(e) => {
                  const newPerms = e.target.checked
                    ? [...student.permissions, perm]
                    : student.permissions.filter((p: string) => p !== perm);
                  onUpdate(student.studentId, { permissions: newPerms });
                }}
                className="w-4 h-4 text-vh-red border-gray-300 rounded focus:ring-vh-red"
              />
              <span className="text-sm text-gray-700">{perm}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// Component for grant access modal
function GrantAccessModal({ open, data, batches, onClose, onGrant, setData }: any) {
  const batchOptions: string[] = Array.from(new Set<string>((batches || []).map((b: any) => b.name as string))).sort();
  return (
    <Modal open={open} onClose={onClose} title="Grant System Access" width={672}>
      <div className="space-y-4">
          <div className="p-4 mb-4" style={{ background: INFO_BG, border: `1px solid ${INFO}33`, borderRadius: R_MD }}>
            <p className="text-sm" style={{ color: INFO }}>
              <strong>Note:</strong> This will add the user to the access-control.json file and regenerate the access control system. They will be able to log in and access the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={data.name || ''}
                onChange={(e) => setData({ ...data, name: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
              <input
                type="email"
                value={data.email || ''}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Student ID * (6 digits)</label>
              <input
                type="text"
                value={data.studentId || ''}
                onChange={(e) => setData({ ...data, studentId: e.target.value })}
                placeholder="e.g., 757516"
                maxLength={6}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Class *</label>
              <input
                type="text"
                value={data.class || ''}
                onChange={(e) => setData({ ...data, class: e.target.value })}
                placeholder="e.g., DU-FBS, BUP-IBA"
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Batch *</label>
              <select
                value={data.batch || ''}
                onChange={(e) => setData({ ...data, batch: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none bg-white"
              >
                <option value="">Select a batch…</option>
                {batchOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Permissions</label>
            <div className="flex flex-wrap gap-3">
              {['read', 'write', 'admin', 'manage_users'].map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer bg-gray-50 px-4 py-2 rounded-lg border-2 border-gray-200 hover:border-vh-red/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={data.permissions?.includes(perm) || false}
                    onChange={(e) => {
                      const newPerms = e.target.checked
                        ? [...(data.permissions || []), perm]
                        : (data.permissions || []).filter((p: string) => p !== perm);
                      setData({ ...data, permissions: newPerms });
                    }}
                    className="w-4 h-4 text-vh-red border-gray-300 rounded focus:ring-vh-red"
                  />
                  <span className="text-sm font-medium text-gray-700">{perm}</span>
                </label>
              ))}
            </div>
          </div>
        <div className="pt-5 flex justify-end gap-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onGrant}
            disabled={!data.name || !data.email || !data.studentId || !data.class || !data.batch}
            className="px-6 py-2 bg-vh-red text-white rounded-lg hover:bg-vh-dark-red transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Grant Access
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FreeSignupCard({ signup }: { signup: FreeSignup }) {
  const waDigits = signup.whatsapp.replace(/[^\d]/g, '');
  const waUrl = waDigits ? `https://wa.me/${waDigits}` : null;
  const created = typeof signup.createdAt === 'number'
    ? new Date(signup.createdAt * 1000)
    : new Date(signup.createdAt);
  const createdLabel = isNaN(created.getTime())
    ? '—'
    : created.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="p-6" style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: R_XL, boxShadow: SHADOW_SM }}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">{signup.name}</h3>
            <span className="px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5" style={{ background: WARN_BG, color: WARN, borderRadius: R_PILL }}>
              <Sparkles className="w-3 h-3" />
              FREE
            </span>
          </div>
          <p className="text-gray-600 break-all">{signup.email}</p>
          <p className="text-sm text-gray-500 mt-1">Signed up {createdLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 mb-1">WhatsApp</p>
          <p className="text-sm font-medium text-gray-900 break-all">{signup.whatsapp}</p>
        </div>
        <div className="flex items-center">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              Contact on WhatsApp
            </a>
          ) : (
            <span className="text-sm text-gray-400">No valid number</span>
          )}
        </div>
      </div>
    </div>
  );
}
