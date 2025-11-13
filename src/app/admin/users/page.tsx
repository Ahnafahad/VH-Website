'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Edit2,
  Save,
  X,
  Trash2,
  RefreshCw,
  Search,
  Shield,
  CheckCircle,
  XCircle,
  Mail,
  Hash,
  BookOpen
} from 'lucide-react';

type User = {
  _id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'student';
  adminId?: string;
  studentId?: string;
  class?: string;
  batch?: string;
  accessTypes: {
    IBA: boolean;
    DU: boolean;
    FBS: boolean;
  };
  mockAccess: {
    duIba: boolean;
    bupIba: boolean;
    duFbs: boolean;
    bupFbs: boolean;
    fbsDetailed: boolean;
  };
  permissions: string[];
  active: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  // Edit/Add modal
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      loadUsers();
    }
  }, [session]);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users || []);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.studentId?.toLowerCase().includes(term) ||
        u.class?.toLowerCase().includes(term)
      );
    }

    setFilteredUsers(filtered);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      name: '',
      role: 'student',
      studentId: '',
      class: '',
      batch: '',
      accessTypes: { IBA: false, DU: false, FBS: false },
      mockAccess: {
        duIba: false,
        bupIba: false,
        duFbs: false,
        bupFbs: false,
        fbsDetailed: false
      },
      permissions: ['read'],
      active: true
    });
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setFormData({});
  };

  const saveUser = async () => {
    try {
      const endpoint = editingUser
        ? '/api/admin/users'
        : '/api/admin/users';

      const method = editingUser ? 'PATCH' : 'POST';
      const body = editingUser
        ? { userId: editingUser._id, ...formData }
        : formData;

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save user');
      }

      closeModal();
      await loadUsers();
      alert(editingUser ? 'User updated successfully!' : 'User created successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete user');
      }

      await loadUsers();
      alert('User deleted successfully!');
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-vh-red animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadUsers}
            className="mt-4 px-6 py-2 bg-vh-red text-white rounded-lg hover:bg-vh-dark-red transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'super_admin' || u.role === 'admin').length,
    students: users.filter(u => u.role === 'student').length,
    active: users.filter(u => u.active).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">User Management</h1>
              <p className="text-gray-600">Manage all users and their access control</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadUsers}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-vh-red text-white rounded-lg hover:bg-vh-dark-red transition-colors font-semibold"
              >
                <UserPlus className="w-4 h-4" />
                Add User
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-semibold">Total Users</p>
                  <p className="text-3xl font-black text-blue-700">{stats.total}</p>
                </div>
                <Users className="w-10 h-10 text-blue-500" />
              </div>
            </div>
            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-semibold">Admins</p>
                  <p className="text-3xl font-black text-purple-700">{stats.admins}</p>
                </div>
                <Shield className="w-10 h-10 text-purple-500" />
              </div>
            </div>
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-semibold">Students</p>
                  <p className="text-3xl font-black text-green-700">{stats.students}</p>
                </div>
                <BookOpen className="w-10 h-10 text-green-500" />
              </div>
            </div>
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-600 text-sm font-semibold">Active</p>
                  <p className="text-3xl font-black text-yellow-700">{stats.active}</p>
                </div>
                <CheckCircle className="w-10 h-10 text-yellow-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6 p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, email, student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none transition-all bg-white"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="student">Student</option>
            </select>
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {filteredUsers.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-12 text-center">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <UserCard
                key={user._id}
                user={user}
                onEdit={openEditModal}
                onDelete={deleteUser}
              />
            ))
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <UserModal
          user={editingUser}
          formData={formData}
          setFormData={setFormData}
          onSave={saveUser}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// User Card Component
function UserCard({ user, onEdit, onDelete }: any) {
  const isAdmin = user.role === 'super_admin' || user.role === 'admin';

  return (
    <div className={`bg-gradient-to-br ${isAdmin ? 'from-purple-50 to-white border-purple-200' : 'from-white to-gray-50 border-gray-200'} rounded-xl border-2 p-6 hover:border-vh-red/30 transition-all`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              user.role === 'super_admin' ? 'bg-red-100 text-red-700' :
              user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {user.role.replace('_', ' ').toUpperCase()}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {user.active ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-gray-600 text-sm">
            <div className="flex items-center gap-1">
              <Mail className="w-4 h-4" />
              {user.email}
            </div>
            {user.studentId && (
              <div className="flex items-center gap-1">
                <Hash className="w-4 h-4" />
                {user.studentId}
              </div>
            )}
            {user.class && (
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                {user.class}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(user)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 className="w-5 h-5" />
          </button>
          {user.role !== 'super_admin' && (
            <button
              onClick={() => onDelete(user._id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <>
          {/* Access Types */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 mb-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Access Types</p>
            <div className="flex flex-wrap gap-2">
              {user.accessTypes.IBA && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                  IBA (DU IBA + BUP IBA Mocks)
                </span>
              )}
              {user.accessTypes.DU && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                  DU (DU IBA + DU FBS Mocks)
                </span>
              )}
              {user.accessTypes.FBS && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                  FBS (DU FBS + BUP FBS Mocks)
                </span>
              )}
              {!user.accessTypes.IBA && !user.accessTypes.DU && !user.accessTypes.FBS && (
                <span className="text-gray-500 text-sm">No access types assigned</span>
              )}
            </div>
          </div>

          {/* Individual Mock Access */}
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <p className="text-sm font-semibold text-gray-700 mb-2">Individual Mock Access</p>
            <div className="flex flex-wrap gap-2">
              {user.mockAccess.duIba && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">DU IBA</span>}
              {user.mockAccess.bupIba && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">BUP IBA</span>}
              {user.mockAccess.duFbs && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">DU FBS</span>}
              {user.mockAccess.bupFbs && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">BUP FBS</span>}
              {user.mockAccess.fbsDetailed && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">FBS Detailed</span>}
              {!Object.values(user.mockAccess).some(v => v) && (
                <span className="text-gray-500 text-sm">No individual mock access</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// User Modal Component (continues in next message due to length...)
function UserModal({ user, formData, setFormData, onSave, onClose }: any) {
  const isEditing = !!user;
  const isStudent = formData.role === 'student';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full my-8">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit User' : 'Add New User'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
                    placeholder="Full Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Role *</label>
                  <select
                    value={formData.role || 'student'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none bg-white"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                  <select
                    value={formData.active ? 'active' : 'inactive'}
                    onChange={(e) => setFormData({ ...formData, active: e.target.value === 'active' })}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Student-specific fields */}
            {isStudent && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Student Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Student ID (6 digits)</label>
                    <input
                      type="text"
                      value={formData.studentId || ''}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      maxLength={6}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
                      placeholder="123456"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Class</label>
                    <input
                      type="text"
                      value={formData.class || ''}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
                      placeholder="e.g., DU-FBS"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Batch</label>
                    <input
                      type="text"
                      value={formData.batch || ''}
                      onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red focus:ring-2 focus:ring-vh-red/20 outline-none"
                      placeholder="e.g., 2025"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Access Types (for students only) */}
            {isStudent && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Access Types</h3>
                <p className="text-sm text-gray-600 mb-4">Select broad access categories that automatically grant specific mock access</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-vh-red/50 transition-colors bg-blue-50">
                    <input
                      type="checkbox"
                      checked={formData.accessTypes?.IBA || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        accessTypes: { ...formData.accessTypes, IBA: e.target.checked }
                      })}
                      className="w-5 h-5 text-vh-red border-gray-300 rounded focus:ring-vh-red mt-1"
                    />
                    <div>
                      <span className="font-bold text-gray-900 block">IBA</span>
                      <span className="text-xs text-gray-600">Auto grants: DU IBA Mocks, BUP IBA Mocks</span>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-vh-red/50 transition-colors bg-purple-50">
                    <input
                      type="checkbox"
                      checked={formData.accessTypes?.FBS || false}
                      onChange={(e) => setFormData({
                        ...formData,
                        accessTypes: { ...formData.accessTypes, FBS: e.target.checked }
                      })}
                      className="w-5 h-5 text-vh-red border-gray-300 rounded focus:ring-vh-red mt-1"
                    />
                    <div>
                      <span className="font-bold text-gray-900 block">FBS</span>
                      <span className="text-xs text-gray-600">Auto grants: DU FBS Mocks, BUP FBS Mocks</span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Individual Mock Access (for students only) */}
            {isStudent && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Individual Mock Access</h3>
                <p className="text-sm text-gray-600 mb-4">Fine-grained control for specific mocks (for future use)</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.keys(formData.mockAccess || {}).map((mockKey) => (
                    <label key={mockKey} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={formData.mockAccess?.[mockKey] || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          mockAccess: { ...formData.mockAccess, [mockKey]: e.target.checked }
                        })}
                        className="w-4 h-4 text-vh-red border-gray-300 rounded focus:ring-vh-red"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {mockKey.replace(/([A-Z])/g, ' $1').toUpperCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Permissions</h3>
              <div className="flex flex-wrap gap-3">
                {['read', 'write', 'admin', 'manage_users'].map((perm) => (
                  <label key={perm} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={formData.permissions?.includes(perm) || false}
                      onChange={(e) => {
                        const newPerms = e.target.checked
                          ? [...(formData.permissions || []), perm]
                          : (formData.permissions || []).filter((p: string) => p !== perm);
                        setFormData({ ...formData, permissions: newPerms });
                      }}
                      className="w-4 h-4 text-vh-red border-gray-300 rounded focus:ring-vh-red"
                    />
                    <span className="text-sm font-medium text-gray-700">{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-6 py-2 bg-vh-red text-white rounded-lg hover:bg-vh-dark-red transition-colors font-semibold flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isEditing ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
