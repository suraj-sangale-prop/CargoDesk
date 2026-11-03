import React, { useState, useEffect, useMemo } from "react";
import CommonModal from "../common/commonModal";
import ResetConfirmation from "../common/items/commonConfirmation";
import UserFormModal, { ROLE_DEFINITIONS } from "./userFormModal";
import RolesMatrix from "./rolesMatrix";
import OrganizationModal from "./organizationModal";
import OrganizationsList from "./organizationsList";
import { postApiData } from "@/utilities/services/apiService";
import { showToast } from "@/utilities/toastService";
import DocumentTable from "../common/tabels/documentTable";
import { userTableHeadCells } from "@/utilities/masterData";
import {
  FiUsers,
  FiPlus,
  FiSearch,
  FiX,
  FiEdit2,
  FiTrash2,
  FiShield,
  FiCheckCircle,
  FiPhone,
  FiMail,
  FiCheck,
  FiUserCheck,
  FiBriefcase,
  FiTool,
} from "react-icons/fi";
import { ImSpinner9 } from "react-icons/im";

export default function UsersWrapper({ pageData = {} }) {
  const currentUser = pageData?.user || null;
  const isSuperAdmin = currentUser?.role === "super_admin" || currentUser?.email === "suraj@agnibyte.com";

  const [users, setUsers] = useState(pageData?.users || []);
  const [organizations, setOrganizations] = useState(pageData?.organizations || []);
  const [isLoading, setIsLoading] = useState(!pageData?.users);
  const [activeTab, setActiveTab] = useState("users"); // "users" | "roles" | "organizations"
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState([]);

  // User Form modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User Delete modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Organization Form modal state
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [isOrgEditMode, setIsOrgEditMode] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [isOrgSubmitting, setIsOrgSubmitting] = useState(false);

  // Organization Delete modal state
  const [isOrgDeleteModalOpen, setIsOrgDeleteModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState(null);
  const [isOrgDeleting, setIsOrgDeleting] = useState(false);

  // Quick role change dropdown
  const [activeRoleDropdown, setActiveRoleDropdown] = useState(null);

  useEffect(() => {
    const handleGlobalClick = () => setActiveRoleDropdown(null);
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await postApiData("GET_ALL_SUB_USERS");
      if (res?.status && Array.isArray(res.data)) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error("Error loading users:", err);
      showToast({ message: "Failed to load sub-users", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const res = await postApiData("GET_ALL_ORGANIZATIONS");
      if (res?.status && Array.isArray(res.data)) {
        setOrganizations(res.data);
      }
    } catch (err) {
      console.error("Error loading organizations:", err);
    }
  };

  useEffect(() => {
    if (!pageData?.users || pageData.users.length === 0) {
      loadUsers();
    }
    loadOrganizations();
  }, []);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = users.length;
    let superAdmins = 0;
    let orgAdmins = 0;
    let officeStaff = 0;
    let maintenance = 0;
    let activeCount = 0;

    users.forEach((u) => {
      const r = (u.role || "").toLowerCase();
      const s = (u.status || "").toLowerCase();

      if (r === "super_admin" || u.email === "suraj@agnibyte.com") superAdmins += 1;
      else if (r === "admin") orgAdmins += 1;
      else if (r === "office_staff" || r === "manager" || r === "dispatcher") officeStaff += 1;
      else if (r === "maintenance_supervisor" || r === "viewer") maintenance += 1;

      if (s === "active" || s === "1") activeCount += 1;
    });

    return { total, superAdmins, orgAdmins, officeStaff, maintenance, activeCount, orgCount: organizations.length };
  }, [users, organizations]);

  // Filtered display list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        const phone = (u.phone || "").toLowerCase();
        const role = (u.role || "").toLowerCase();
        const orgName = (u.orgName || "").toLowerCase();

        if (
          !fullName.includes(query) &&
          !email.includes(query) &&
          !phone.includes(query) &&
          !role.includes(query) &&
          !orgName.includes(query)
        ) {
          return false;
        }
      }

      // 2. Role filter
      if (roleFilter !== "all") {
        let r = (u.role || "").toLowerCase();
        if (r === "manager" || r === "dispatcher") r = "office_staff";
        if (r === "viewer") r = "maintenance_supervisor";
        if (r !== roleFilter.toLowerCase()) return false;
      }

      // 3. Organization filter
      if (orgFilter !== "all") {
        if (String(u.orgId) !== String(orgFilter)) return false;
      }

      // 4. Status filter
      if (statusFilter !== "all") {
        const s = (u.status || "").toLowerCase();
        const isActive = s === "active" || s === "1";
        if (statusFilter === "active" && !isActive) return false;
        if (statusFilter === "inactive" && isActive) return false;
      }

      // 5. Tenant Organization Isolation: Non-superadmins only see their own organization members
      if (!isSuperAdmin && currentUser?.orgId) {
        if (Number(u.orgId) !== Number(currentUser.orgId) && u.role !== "super_admin") {
          return false;
        }
      }

      return true;
    });
  }, [users, searchTerm, roleFilter, orgFilter, statusFilter, isSuperAdmin, currentUser]);

  // Formatted data for DocumentTable
  const finalDisplayData = useMemo(() => {
    return filteredUsers.map((u, index) => {
      const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User";
      const initial = (u.firstName ? u.firstName.charAt(0) : "U").toUpperCase();
      const isActive = (u.status || "").toLowerCase() === "active" || u.status === "1";
      const isSuper = u.email === "suraj@agnibyte.com" || u.role === "super_admin";

      return {
        ...u,
        id: u.userId ?? index + 1,
        member: fullName,
        fullName,
        initial,
        isActive,
        isSuper,
      };
    });
  }, [filteredUsers]);

  // Dynamic table head cells with custom renderers
  const userHeadCells = useMemo(() => {
    return userTableHeadCells.map((headCell) => {
      if (headCell.id === "member") {
        return {
          ...headCell,
          render: (_, row) => {
            const fullName = row.fullName || `${row.firstName || ""} ${row.lastName || ""}`.trim() || "User";
            const initial = row.initial || (row.firstName ? row.firstName.charAt(0) : "U").toUpperCase();
            const isSuper = row.isSuper;

            return (
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-full text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ${isSuper
                      ? "bg-gradient-to-tr from-purple-600 to-indigo-600 ring-2 ring-purple-400/40"
                      : "bg-gradient-to-tr from-blue-600 to-indigo-600"
                    }`}
                >
                  {initial}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-slate-900 truncate">{fullName}</p>
                    {isSuper && (
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1.5 py-0.2 rounded">
                        Super
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">{row.email}</p>
                </div>
              </div>
            );
          },
        };
      }

      if (headCell.id === "role") {
        return {
          ...headCell,
          render: (_, row) => {
            const isSuper = row.isSuper;
            const currentUserId = row.userId || row.id;

            return (
              <div className="relative inline-flex items-center gap-1.5">
                {getRoleBadge(row.role, row.email)}
                {!isSuper && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveRoleDropdown(
                        activeRoleDropdown === currentUserId ? null : currentUserId
                      );
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Change Role"
                  >
                    <FiEdit2 className="w-3 h-3" />
                  </button>
                )}

                {/* Quick Role Dropdown */}
                {activeRoleDropdown === currentUserId && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-0 top-8 z-50 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 text-xs animate-dropdown text-left"
                  >
                    <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Assign Operational Role
                    </p>
                    {ROLE_DEFINITIONS.filter((r) => r.key !== "super_admin").map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => handleQuickRoleChange(currentUserId, r.key)}
                        className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center justify-between cursor-pointer"
                      >
                        <span>{r.name}</span>
                        {row.role === r.key && <FiCheck className="w-3 h-3 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          },
        };
      }

      if (headCell.id === "orgName") {
        return {
          ...headCell,
          render: (_, row) => {
            const isSuper = row.isSuper;
            return row.orgName ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                <FiBriefcase className="w-3 h-3 text-purple-600" />
                <span className="truncate max-w-[140px]">{row.orgName}</span>
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 italic">
                {isSuper ? "Global HQ" : "Unassigned"}
              </span>
            );
          },
        };
      }

      if (headCell.id === "phone") {
        return {
          ...headCell,
          render: (rawValue) => (
            <span className="text-slate-600 font-mono text-[11px]">
              {rawValue || "—"}
            </span>
          ),
        };
      }

      if (headCell.id === "status") {
        return {
          ...headCell,
          render: (_, row) => {
            const isActive = row.isActive;
            const isSuper = row.isSuper;

            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isSuper) handleToggleStatus(row);
                }}
                disabled={isSuper}
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all inline-flex items-center gap-1.5 ${isActive
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-rose-50 text-rose-700 border-rose-200"
                  } ${isSuper ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
                title={isSuper ? "Super admin is permanently active" : "Click to toggle status"}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"
                    }`}
                />
                {isActive ? "Active" : "Inactive"}
              </button>
            );
          },
        };
      }

      return headCell;
    });
  }, [activeRoleDropdown, users]);

  // Handle User Form Submit (Add or Edit)
  const handleFormSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      if (isEditMode) {
        const res = await postApiData("UPDATE_SUB_USER", formData);
        if (res?.status) {
          showToast({ message: res.message || "Sub-user updated successfully", type: "success" });
          setIsFormModalOpen(false);
          loadUsers();
          loadOrganizations();
        } else {
          showToast({ message: res?.message || "Failed to update sub-user", type: "error" });
        }
      } else {
        const res = await postApiData("ADD_SUB_USER", formData);
        if (res?.status) {
          showToast({ message: res.message || "Sub-user created successfully", type: "success" });
          setIsFormModalOpen(false);
          loadUsers();
          loadOrganizations();
        } else {
          showToast({ message: res?.message || "Failed to create sub-user", type: "error" });
        }
      }
    } catch (err) {
      console.error("Sub-user save error:", err);
      showToast({ message: "An unexpected error occurred", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setIsEditMode(true);
    setIsFormModalOpen(true);
  };

  const handleOpenAdd = (presetRole = "office_staff", presetOrgId = "") => {
    const targetOrgId = isSuperAdmin ? presetOrgId : (currentUser?.orgId || presetOrgId);
    setSelectedUser({ role: presetRole, orgId: targetOrgId });
    setIsEditMode(false);
    setIsFormModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete && selected.length === 0) return;
    setIsDeleting(true);
    try {
      const payload = selected.length > 0 ? { ids: selected } : { userId: userToDelete?.userId || userToDelete?.id };
      const res = await postApiData("DELETE_SUB_USER", payload);
      if (res?.status) {
        showToast({ message: res.message || "Sub-user deleted successfully", type: "success" });
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
        setSelected([]);
        loadUsers();
        loadOrganizations();
      } else {
        showToast({ message: res?.message || "Failed to delete sub-user", type: "error" });
      }
    } catch (err) {
      showToast({ message: "Error deleting sub-user", type: "error" });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Edit Action from DocumentTable
  const onClickEdit = (id, row) => {
    const targetUser =
      (typeof row === "object" && row !== null && (row.userId || row.id) ? row : null) ||
      users.find((u) => u.userId === id || u.id === id);
    if (targetUser) {
      handleOpenEdit(targetUser);
    }
  };

  const handleQuickRoleChange = async (userId, newRole) => {
    setActiveRoleDropdown(null);
    try {
      const res = await postApiData("UPDATE_SUB_USER", { userId, role: newRole });
      if (res?.status) {
        showToast({ message: `Role changed to ${newRole}`, type: "success" });
        loadUsers();
        loadOrganizations();
      } else {
        showToast({ message: res?.message || "Could not change role", type: "error" });
      }
    } catch (err) {
      showToast({ message: "Error updating role", type: "error" });
    }
  };

  const handleToggleStatus = async (user) => {
    const isCurrentlyActive = (user.status || "").toLowerCase() === "active" || user.status === "1";
    const nextStatus = isCurrentlyActive ? "0" : "1";
    try {
      const res = await postApiData("UPDATE_SUB_USER", {
        userId: user.userId,
        status: nextStatus,
      });
      if (res?.status) {
        showToast({
          message: `User marked as ${nextStatus === "1" ? "Active" : "Inactive"}`,
          type: "success",
        });
        loadUsers();
      } else {
        showToast({ message: res?.message || "Could not update status", type: "error" });
      }
    } catch (err) {
      showToast({ message: "Error toggling status", type: "error" });
    }
  };

  // Organization operations
  const handleOrgSubmit = async (formData) => {
    setIsOrgSubmitting(true);
    try {
      if (isOrgEditMode) {
        const res = await postApiData("UPDATE_ORGANIZATION", formData);
        if (res?.status) {
          showToast({ message: res.message || "Organization updated", type: "success" });
          setIsOrgModalOpen(false);
          loadOrganizations();
          loadUsers();
        } else {
          showToast({ message: res?.message || "Failed to update organization", type: "error" });
        }
      } else {
        const res = await postApiData("CREATE_ORGANIZATION", formData);
        if (res?.status) {
          showToast({ message: res.message || "Organization created", type: "success" });
          setIsOrgModalOpen(false);
          loadOrganizations();
          loadUsers();
        } else {
          showToast({ message: res?.message || "Failed to create organization", type: "error" });
        }
      }
    } catch (err) {
      showToast({ message: "Error saving organization", type: "error" });
    } finally {
      setIsOrgSubmitting(false);
    }
  };

  const handleConfirmOrgDelete = async () => {
    if (!orgToDelete) return;
    setIsOrgDeleting(true);
    try {
      const res = await postApiData("DELETE_ORGANIZATION", { orgId: orgToDelete.orgId });
      if (res?.status) {
        showToast({ message: "Organization deleted successfully", type: "success" });
        setIsOrgDeleteModalOpen(false);
        setOrgToDelete(null);
        loadOrganizations();
        loadUsers();
      } else {
        showToast({ message: res?.message || "Failed to delete organization", type: "error" });
      }
    } catch (err) {
      showToast({ message: "Error deleting organization", type: "error" });
    } finally {
      setIsOrgDeleting(false);
    }
  };

  // Helper for Role badge styling
  const getRoleBadge = (roleKey, email) => {
    if (email === "suraj@agnibyte.com" || roleKey === "super_admin") {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-purple-100 text-purple-700 border-purple-200">
          <FiShield className="w-3 h-3 text-purple-600" />
          Super Admin
        </span>
      );
    }

    let normalizedKey = (roleKey || "").toLowerCase();
    if (normalizedKey === "manager" || normalizedKey === "dispatcher") normalizedKey = "office_staff";
    if (normalizedKey === "viewer") normalizedKey = "maintenance_supervisor";

    const matched = ROLE_DEFINITIONS.find((r) => r.key === normalizedKey);
    if (matched) {
      return (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${matched.badgeColor}`}
        >
          {matched.key === "admin" && <FiBriefcase className="w-3 h-3" />}
          {matched.key === "office_staff" && <FiUserCheck className="w-3 h-3" />}
          {matched.key === "maintenance_supervisor" && <FiTool className="w-3 h-3" />}
          {matched.name}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
        {roleKey || "Staff"}
      </span>
    );
  };

  return (
    <div className="py-6 space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-600 mb-1">
            <FiShield className="w-3.5 h-3.5" />
            <span>Super Administrator Control Panel</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
            Organizations, Sub-Users & Roles
          </h1>
          {/* <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Super Admin global control: provision tenant Organizations, assign Organization Administrators, and manage Operations Coordinators and Fleet Maintenance Supervisors.
          </p> */}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {isSuperAdmin && (
            <button
              onClick={() => {
                setSelectedOrg(null);
                setIsOrgEditMode(false);
                setIsOrgModalOpen(true);
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <FiBriefcase className="w-4 h-4" />
              <span>+ New Organization</span>
            </button>
          )}

          <button
            onClick={() => handleOpenAdd("office_staff")}
            className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <FiPlus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Sub-User</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Organizations */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FiBriefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Organizations</p>
            <p className="text-xl font-bold text-slate-800">{stats.orgCount}</p>
          </div>
        </div>

        {/* Org Admins */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FiShield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Org Admins</p>
            <p className="text-xl font-bold text-slate-800">{stats.orgAdmins}</p>
          </div>
        </div>

        {/* Office Staff */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <FiUserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operations Staff</p>
            <p className="text-xl font-bold text-slate-800">{stats.officeStaff}</p>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FiTool className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Maintenance</p>
            <p className="text-xl font-bold text-slate-800">{stats.maintenance}</p>
          </div>
        </div>

        {/* Active Accounts */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 col-span-2 lg:col-span-1">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FiCheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Status</p>
            <p className="text-xl font-bold text-emerald-600">
              {stats.activeCount} <span className="text-xs text-slate-400 font-normal">/ {stats.total}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Container with Navigation Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="flex border-b border-slate-200/80 px-4 sm:px-6 pt-3 bg-slate-50/50 gap-2 sm:gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === "users"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <FiUsers className="w-4 h-4" />
            <span>All Members ({filteredUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("organizations")}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === "organizations"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <FiBriefcase className="w-4 h-4" />
            <span>Organizations ({organizations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("roles")}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${activeTab === "roles"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            <FiShield className="w-4 h-4" />
            <span>Role Permissions Matrix</span>
          </button>
        </div>

        {/* TAB 1: USERS LISTING */}
        {activeTab === "users" && (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Field */}
              <div className="relative flex-1 max-w-md">
                <FiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search members by name, email, role, or company..."
                  className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Filter Dropdowns */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                {/* Organization Filter */}
                <select
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                >
                  <option value="all">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.orgId} value={org.orgId}>
                      {org.orgName}
                    </option>
                  ))}
                </select>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Roles</option>
                  {ROLE_DEFINITIONS.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>

            {/* Loading Indicator */}
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                <ImSpinner9 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                <p className="text-xs font-medium">Loading members list...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              /* Empty state */
              <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <FiUsers className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800">No members found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchTerm || roleFilter !== "all" || orgFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search criteria or resetting filters."
                    : "No sub-users have been added yet. Click 'Add Sub-User' to invite your first team member."}
                </p>
                <button
                  onClick={() => handleOpenAdd("office_staff")}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all"
                >
                  Add First Member
                </button>
              </div>
            ) : (
              <>
                {/* DESKTOP TABLE VIEW - Common DocumentTable */}
                <div className="hidden md:block">
                  <DocumentTable
                    rows={finalDisplayData}
                    headCells={userHeadCells}
                    onClickEdit={onClickEdit}
                    selected={selected}
                    setSelected={setSelected}
                    onClickDelete={(ids) => {
                      const idList = Array.isArray(ids) ? ids : [ids];
                      const targets = users.filter((u) => idList.includes(u.userId) || idList.includes(u.id));
                      const hasSuperAdmin = targets.some((u) => u.role === "super_admin" || u.email === "suraj@agnibyte.com");
                      if (hasSuperAdmin) {
                        showToast({ message: "Cannot delete the Super Administrator account", type: "error" });
                        return;
                      }
                      setSelected(idList);
                      setUserToDelete(targets[0] || null);
                      setIsDeleteModalOpen(true);
                    }}
                    searchTerm={searchTerm}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    isLoading={isLoading}
                    tableName="users"
                  />
                </div>

                {/* MOBILE CARD VIEW */}
                <div className="md:hidden space-y-3">
                  {filteredUsers.map((u) => {
                    const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim() || "User";
                    const initial = (u.firstName ? u.firstName.charAt(0) : "U").toUpperCase();
                    const isActive = (u.status || "").toLowerCase() === "active" || u.status === "1";
                    const isSuper = u.email === "suraj@agnibyte.com" || u.role === "super_admin";

                    return (
                      <div
                        key={u.userId}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                      >
                        {/* Top row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full text-white font-bold text-sm flex items-center justify-center shrink-0 ${isSuper ? "bg-purple-600" : "bg-blue-600"
                                }`}
                            >
                              {initial}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-bold text-slate-900 text-sm">{fullName}</h4>
                                {isSuper && (
                                  <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-1 py-0.2 rounded">
                                    Super
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{u.email}</p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </div>

                        {/* Mid row: Role + Organization */}
                        <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                          <div>{getRoleBadge(u.role, u.email)}</div>

                          {u.orgName && (
                            <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <FiBriefcase className="w-3 h-3 text-purple-600" />
                              {u.orgName}
                            </span>
                          )}

                          <div className="flex items-center gap-2 ml-auto">
                            {u.phone && (
                              <a
                                href={`tel:${u.phone}`}
                                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-blue-600"
                                title="Call user"
                              >
                                <FiPhone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <a
                              href={`mailto:${u.email}`}
                              className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-blue-600"
                              title="Email user"
                            >
                              <FiMail className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Bottom action buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="flex-1 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {!isSuper && (
                            <button
                              onClick={() => {
                                setUserToDelete(u);
                                setIsDeleteModalOpen(true);
                              }}
                              className="py-1.5 px-3 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors flex items-center justify-center gap-1.5"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: ORGANIZATIONS LISTING */}
        {activeTab === "organizations" && (
          <div className="p-4 sm:p-6">
            <OrganizationsList
              organizations={organizations}
              onOpenCreate={() => {
                setSelectedOrg(null);
                setIsOrgEditMode(false);
                setIsOrgModalOpen(true);
              }}
              onOpenEdit={(org) => {
                setSelectedOrg(org);
                setIsOrgEditMode(true);
                setIsOrgModalOpen(true);
              }}
              onDelete={(org) => {
                setOrgToDelete(org);
                setIsOrgDeleteModalOpen(true);
              }}
              onAddAdminToOrg={(orgId) => {
                handleOpenAdd("admin", orgId);
              }}
            />
          </div>
        )}

        {/* TAB 3: ROLES MATRIX */}
        {activeTab === "roles" && (
          <div className="p-4 sm:p-6">
            <RolesMatrix
              users={users}
              onAddUserWithRole={(roleKey) => handleOpenAdd(roleKey)}
              onSelectRoleFilter={(roleKey) => {
                setRoleFilter(roleKey);
                setActiveTab("users");
              }}
            />
          </div>
        )}
      </div>

      {/* MODAL 1: Add / Edit User */}
      <UserFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSubmit={handleFormSubmit}
        isEdit={isEditMode}
        userData={selectedUser}
        organizations={organizations}
        currentUser={currentUser}
        isSubmitting={isSubmitting}
      />

      {/* MODAL 2: Delete Sub-User Confirmation */}
      <CommonModal
        modalOpen={isDeleteModalOpen}
        setModalOpen={setIsDeleteModalOpen}
        backDrop={false}
      >
        <ResetConfirmation
          title={
            selected?.length > 1
              ? `Are you sure you want to delete ${selected.length} selected team members?`
              : userToDelete
                ? `Are you sure you want to delete ${userToDelete.firstName || ""} ${userToDelete.lastName || ""} (${userToDelete.email})?`
                : "Are you sure you want to delete this sub-user?"
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            setIsDeleteModalOpen(false);
            setUserToDelete(null);
            setSelected([]);
          }}
          isLoading={isDeleting}
        />
      </CommonModal>

      {/* MODAL 3: Create / Edit Organization */}
      <OrganizationModal
        isOpen={isOrgModalOpen}
        onClose={() => setIsOrgModalOpen(false)}
        onSubmit={handleOrgSubmit}
        isEdit={isOrgEditMode}
        orgData={selectedOrg}
        isSubmitting={isOrgSubmitting}
      />

      {/* MODAL 4: Delete Organization Confirmation */}
      <CommonModal
        modalOpen={isOrgDeleteModalOpen}
        setModalOpen={setIsOrgDeleteModalOpen}
        backDrop={false}
      >
        <ResetConfirmation
          title={
            orgToDelete
              ? `Are you sure you want to delete organization "${orgToDelete.orgName}"? Associated members will be unassigned.`
              : "Are you sure you want to delete this organization?"
          }
          onConfirm={handleConfirmOrgDelete}
          onCancel={() => {
            setIsOrgDeleteModalOpen(false);
            setOrgToDelete(null);
          }}
          isLoading={isOrgDeleting}
        />
      </CommonModal>
    </div>
  );
}
