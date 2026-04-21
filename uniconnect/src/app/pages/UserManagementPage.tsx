import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Power, PowerOff, Shield, GraduationCap, User as UserIcon, Search, Users, UserMinus } from "lucide-react";
import { useApp } from "../context/AppContext.tsx";
import { PopupDialog } from "../components/PopupDialog.tsx";
import { toast } from "sonner";

type ManagedUser = {
  USER_ID: number;
  FIRST_NAME: string;
  LAST_NAME: string;
  EMAIL: string;
  ROLE: string;
  IS_ACTIVE: boolean;
};

export const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useApp();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await fetch("https://uniconnectforum.onrender.com/api/users/");
      if (!res.ok) {
        throw new Error(`users failed with ${res.status}`);
      }

      const data = await res.json();
      setUsers(
        (Array.isArray(data) ? data : []).map((user: any) => ({
          USER_ID: Number(user.USER_ID ?? user.id),
          FIRST_NAME: user.FIRST_NAME ?? user.firstName ?? '',
          LAST_NAME: user.LAST_NAME ?? user.lastName ?? '',
          EMAIL: user.EMAIL ?? user.email ?? '',
          ROLE: user.ROLE ?? user.role ?? 'student',
          IS_ACTIVE: user.IS_ACTIVE !== undefined ? Number(user.IS_ACTIVE) === 1 : Boolean(user.isActive),
        }))
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not load users");
      setUsers([]);
    }
  };

  if (!currentUser || currentUser.role !== "admin") {
    navigate("/");
    return null;
  }

  const visibleUsers = users.filter(user => String(user.USER_ID) !== String(currentUser.id));
  const filteredUsers = visibleUsers.filter(user => {
    const fullName = `${user.FIRST_NAME} ${user.LAST_NAME}`.toLowerCase();
    const email = String(user.EMAIL || "").toLowerCase();
    const role = String(user.ROLE || "").toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    if (!query) return true;
    return fullName.includes(query) || email.includes(query) || role.includes(query);
  });
  const inactiveUserCount = visibleUsers.filter(user => !user.IS_ACTIVE).length;

  const toggleUser = async (id: number) => {
    try {
      const res = await fetch("https://uniconnectforum.onrender.com/api/toggle-user/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not update user");
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.USER_ID === id
            ? { ...user, IS_ACTIVE: Boolean(data.isActive) }
            : user
        )
      );
    } catch (error) {
      console.error(error);
      toast.error("Could not update user status");
      await loadUsers();
    }
  };

  const deleteUser = async (id: number) => {
    try {
      const res = await fetch("https://uniconnectforum.onrender.com/api/delete-user/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not disable user");
      }

      setUsers((prev) =>
        prev.map((user) =>
          user.USER_ID === id ? { ...user, IS_ACTIVE: false } : user
        )
      );
      setUserToDelete(null);
    } catch (error) {
      console.error(error);
      toast.error("Could not disable user");
      await loadUsers();
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PopupDialog
        isOpen={Boolean(userToDelete)}
        title="Remove User?"
        message={
          userToDelete
            ? `${userToDelete.FIRST_NAME} ${userToDelete.LAST_NAME} will be permanently removed from UniConnect.`
            : ""
        }
        confirmLabel="Delete User"
        cancelLabel="Cancel"
        onConfirm={() => userToDelete && deleteUser(userToDelete.USER_ID)}
        onCancel={() => setUserToDelete(null)}
      />

      <button
        onClick={() => navigate("/admin")}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Back to Admin Dashboard
      </button>

      <section className="university-panel overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Administration</p>
          <h1 className="mt-3 university-section-title">User Management</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Review university accounts, disable access when needed, and keep the directory clean.
          </p>
        </div>

        <div className="grid gap-4 border-b border-slate-200 bg-white px-6 py-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
                <Users size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Managed Users</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{visibleUsers.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-50 p-2.5 text-red-700">
                <UserMinus size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Inactive Users</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{inactiveUserCount}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Active Users</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{visibleUsers.length - inactiveUserCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or role"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-200">
        {filteredUsers.map(user => (

          <div
            key={user.USER_ID}
            className="flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-slate-50/70"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-semibold text-slate-900">
                  {user.FIRST_NAME} {user.LAST_NAME}
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    user.ROLE === "faculty"
                      ? "bg-blue-100 text-blue-700"
                      : user.ROLE === "admin"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {user.ROLE === "faculty" ? <GraduationCap size={12} /> : user.ROLE === "admin" ? <Shield size={12} /> : <UserIcon size={12} />}
                  {user.ROLE === "faculty"
                    ? "Faculty"
                    : user.ROLE === "admin"
                      ? "Admin"
                      : "Student"}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {user.EMAIL}
              </div>

              {/* STATUS */}
              <span
                className={`inline-block mt-1 px-2 py-1 text-xs rounded ${
                  user.IS_ACTIVE
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
                >
                  {user.IS_ACTIVE ? "Active" : "Disabled"}
                </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => toggleUser(user.USER_ID)}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-blue-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                {user.IS_ACTIVE ? (
                  <PowerOff size={18} />
                ) : (
                  <Power size={18} />
                )}
              </button>

              <button
                onClick={() => setUserToDelete(user)}
                className="rounded-xl border border-slate-200 bg-white p-2.5 text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
              >
                <Trash2 size={18} />
              </button>

            </div>

          </div>

        ))}
        {filteredUsers.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-500">
            No users match the current filter.
          </div>
        )}
        </div>
      </section>

    </div>
  );
};
