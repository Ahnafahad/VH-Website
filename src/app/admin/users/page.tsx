'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
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
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

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

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  }
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-vh-red-600 border-t-transparent rounded-full mx-auto mb-4"
          />
          <h2 className="text-2xl font-bold text-gray-900">Loading users...</h2>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card variant="elevated" padding="xl" className="max-w-md">
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              >
                <XCircle className="w-16 h-16 text-error-600 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
              <p className="text-error-600 mb-6">{error}</p>
              <Button
                variant="solid"
                colorScheme="primary"
                size="lg"
                onClick={loadUsers}
                className="w-full"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Retry
              </Button>
            </div>
          </Card>
        </motion.div>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-vh-beige/5 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-20 right-20 w-72 h-72 bg-vh-red/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-96 h-96 bg-vh-beige/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

        {/* Header */}
        <motion.div
          className="mb-8"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-black text-gray-900 mb-2">User Management</h1>
              <p className="text-gray-600">Manage all users and their access control</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={loadUsers}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button
                variant="solid"
                colorScheme="primary"
                size="md"
                onClick={openAddModal}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-semibold">Total Users</p>
                    <p className="text-3xl font-black text-blue-700">{stats.total}</p>
                  </div>
                  <Users className="w-10 h-10 text-blue-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-purple-50 to-white border-2 border-purple-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-sm font-semibold">Admins</p>
                    <p className="text-3xl font-black text-purple-700">{stats.admins}</p>
                  </div>
                  <Shield className="w-10 h-10 text-purple-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-success-50 to-white border-2 border-success-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-success-600 text-sm font-semibold">Students</p>
                    <p className="text-3xl font-black text-success-700">{stats.students}</p>
                  </div>
                  <BookOpen className="w-10 h-10 text-success-500" />
                </div>
              </Card>
            </motion.div>
            <motion.div variants={scaleIn}>
              <Card variant="outlined" padding="lg" className="bg-gradient-to-br from-warning-50 to-white border-2 border-warning-200 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-warning-600 text-sm font-semibold">Active</p>
                    <p className="text-3xl font-black text-warning-700">{stats.active}</p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-warning-500" />
                </div>
              </Card>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Filters */}
        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <Card variant="elevated" padding="lg" className="mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red-600 focus:ring-2 focus:ring-vh-red-600/20 outline-none transition-all"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-vh-red-600 focus:ring-2 focus:ring-vh-red-600/20 outline-none transition-all bg-white"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="student">Student</option>
              </select>
            </div>
          </Card>
        </motion.div>

        {/* Users List */}
        <motion.div
          className="space-y-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.4 }}
        >
          {filteredUsers.length === 0 ? (
            <motion.div variants={scaleIn}>
              <Card variant="elevated" padding="xl" className="text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No users found</p>
              </Card>
            </motion.div>
          ) : (
            filteredUsers.map((user) => (
              <motion.div key={user._id} variants={scaleIn}>
                <UserCard
                  user={user}
                  onEdit={openEditModal}
                  onDelete={deleteUser}
                />
              </motion.div>
            ))
          )}
        </motion.div>
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
    <Card
      variant="elevated"
      padding="lg"
      className={`${isAdmin ? 'bg-gradient-to-br from-purple-50 to-white border-purple-200' : ''} hover:shadow-xl transition-all duration-300 group`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
            <Badge
              variant="solid"
              colorScheme={
                user.role === 'super_admin' ? 'error' :
                user.role === 'admin' ? 'warning' :
                'primary'
              }
              size="sm"
            >
              {user.role.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge
              variant="solid"
              colorScheme={user.active ? 'success' : 'error'}
              size="sm"
            >
              {user.active ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-gray-600 text-sm flex-wrap">
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
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(user)}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
          >
            <Edit2 className="w-5 h-5" />
          </Button>
          {user.role !== 'super_admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(user._id)}
              className="text-error-600 hover:text-error-800 hover:bg-error-50"
            >
              <Trash2 className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <>
          {/* Access Types */}
          <Card variant="outlined" padding="md" className="mb-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Access Types</p>
            <div className="flex flex-wrap gap-2">
              {user.accessTypes.IBA && (
                <Badge variant="solid" colorScheme="primary" size="sm">
                  IBA (DU IBA + BUP IBA Mocks)
                </Badge>
              )}
              {user.accessTypes.DU && (
                <Badge variant="solid" colorScheme="success" size="sm">
                  DU (DU IBA + DU FBS Mocks)
                </Badge>
              )}
              {user.accessTypes.FBS && (
                <Badge variant="solid" colorScheme="warning" size="sm">
                  FBS (DU FBS + BUP FBS Mocks)
                </Badge>
              )}
              {!user.accessTypes.IBA && !user.accessTypes.DU && !user.accessTypes.FBS && (
                <span className="text-gray-500 text-sm">No access types assigned</span>
              )}
            </div>
          </Card>

          {/* Individual Mock Access */}
          <Card variant="outlined" padding="md">
            <p className="text-sm font-semibold text-gray-700 mb-2">Individual Mock Access</p>
            <div className="flex flex-wrap gap-2">
              {user.mockAccess.duIba && <Badge variant="outline" size="sm">DU IBA</Badge>}
              {user.mockAccess.bupIba && <Badge variant="outline" size="sm">BUP IBA</Badge>}
              {user.mockAccess.duFbs && <Badge variant="outline" size="sm">DU FBS</Badge>}
              {user.mockAccess.bupFbs && <Badge variant="outline" size="sm">BUP FBS</Badge>}
              {user.mockAccess.fbsDetailed && <Badge variant="outline" size="sm">FBS Detailed</Badge>}
              {!Object.values(user.mockAccess).some(v => v) && (
                <span className="text-gray-500 text-sm">No individual mock access</span>
              )}
            </div>
          </Card>
        </>
      )}
    </Card>
  );
}

// User Modal Component
function UserModal({ user, formData, setFormData, onSave, onClose }: any) {
  const isEditing = !!user;
  const isStudent = formData.role === 'student';

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full my-8"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit User' : 'Add New User'}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </Button>
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
          <Button
            variant="outline"
            size="lg"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="solid"
            colorScheme="primary"
            size="lg"
            onClick={onSave}
          >
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
