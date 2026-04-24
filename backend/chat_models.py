"""김삼일 AI 챗봇 — 대화 세션 + FAQ 모델"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from database import Base


class ChatSession(Base):
    """사용자 대화 세션 — 여러 메시지를 하나로 묶음"""
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String, nullable=True, index=True)   # 로그인 안 되어 있으면 null
    session_title = Column(String, nullable=True)           # 첫 메시지로 자동 생성
    page_context = Column(String, nullable=True)            # 시작 당시 페이지
    message_count = Column(Integer, default=0)
    started_at = Column(DateTime, server_default=func.now())
    last_active_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ChatMessage(Base):
    """개별 메시지 (user/assistant/tool)"""
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)                   # user | assistant | tool
    content = Column(Text, nullable=False)
    actions_json = Column(Text, nullable=True)              # actions 배열 (JSON)
    suggestions_json = Column(Text, nullable=True)          # suggestions 배열 (JSON)
    current_page = Column(String, nullable=True)
    matched_faq_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Faq(Base):
    """자주 묻는 질문 (FAQ)"""
    __tablename__ = "faqs"
    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, nullable=False, default="기타", index=True)
    question = Column(String, nullable=False)
    answer = Column(Text, nullable=False)
    keywords = Column(Text, nullable=True)                  # 검색용 키워드 (쉼표 구분)
    action_route = Column(String, nullable=True)            # navigate 액션
    action_handler = Column(String, nullable=True)          # execute 액션
    view_count = Column(Integer, default=0)
    helpful_count = Column(Integer, default=0)
    not_helpful_count = Column(Integer, default=0)
    is_published = Column(Boolean, default=True, index=True)
    priority = Column(Integer, default=0)                   # 상단 고정용 (높을수록 위)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FaqFeedback(Base):
    """FAQ 도움됨/안됨 피드백"""
    __tablename__ = "faq_feedbacks"
    id = Column(Integer, primary_key=True, index=True)
    faq_id = Column(Integer, ForeignKey("faqs.id", ondelete="CASCADE"), nullable=False)
    user_name = Column(String, nullable=True)
    is_helpful = Column(Boolean, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
