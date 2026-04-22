"""Admin models - merged from easy-view-admin"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Date
from sqlalchemy.sql import func
from database import Base


class AdminUser(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    company = Column(String, nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    role = Column(String, default="viewer")        # admin, manager, viewer
    status = Column(String, default="active")      # active, inactive, pending
    trust_level = Column(String, default="normal") # high, normal, low
    two_fa = Column(Boolean, default=False)
    hashed_password = Column(String, nullable=True)
    password_expiry = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class AdminGroup(Base):
    __tablename__ = "groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    company = Column(String, nullable=False)
    default_role = Column(String, default="viewer")
    report_count = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, server_default=func.now())
    actor = Column(String, nullable=False)
    action_type = Column(String, nullable=False)
    detail = Column(String, nullable=True)
    target = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)


class ReportPermission(Base):
    __tablename__ = "report_permissions"
    id = Column(Integer, primary_key=True, index=True)
    report_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    can_view = Column(Boolean, default=False)
    can_download = Column(Boolean, default=False)
    can_print = Column(Boolean, default=False)
    can_share = Column(Boolean, default=False)
    can_comment = Column(Boolean, default=False)


class UserPermission(Base):
    __tablename__ = "user_permissions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    can_view_report = Column(Boolean, default=True)
    can_upload = Column(Boolean, default=False)
    can_pdf = Column(Boolean, default=False)
    can_excel = Column(Boolean, default=False)
    can_print = Column(Boolean, default=False)
    can_share = Column(Boolean, default=False)
    can_comment = Column(Boolean, default=True)
    can_request_user = Column(Boolean, default=False)


class AdminRole(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    permissions = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class AdminCompany(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    subsidiary_name = Column(String, nullable=True)
    biz_start = Column(Date, nullable=True)
    biz_end = Column(Date, nullable=True)
    country = Column(String, nullable=True)
    company_type = Column(String, nullable=True)
    contract_start = Column(Date, nullable=True)
    contract_end = Column(Date, nullable=True)
    base_currency = Column(String, nullable=True)
    base_period = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AdminSubsidiary(Base):
    __tablename__ = "subsidiaries"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class UserAddRequest(Base):
    __tablename__ = "user_add_requests"
    id = Column(Integer, primary_key=True, index=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_name = Column(String, nullable=False)
    target_email = Column(String, nullable=False)
    reason = Column(String, nullable=True)
    status = Column(String, default="pending")
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
