// API Response Types
export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
  error?: string;
  status?: string;
}

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  uin: string;
  username?: string;
  locale?: string;
  /** online / offline */
  status?: 'online' | 'offline';
  online_status?: string;
  custom_status?: string | null;
  last_seen_at?: string | null;
  public_key?: string;
  created_at?: string;
  updated_at?: string;
}

// Authentication Types
export interface LoginRequest {
  login: string; // email or UIN
  password: string;
  device_name?: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface LoginResponse {
  requires_confirmation?: boolean;
  message?: string;
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: User;
}

export interface ConfirmLoginRequest {
  token: string;
}

export interface ConfirmLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: Pick<User, 'id' | 'name' | 'email' | 'uin' | 'username'>;
}

// Pagination Types
export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// Chat Types
export interface Chat {
  id: number;
  type: 'private' | 'group' | 'favorites';
  name?: string;
  creator_id?: string;
  created_at: string;
  updated_at: string;
  users?: ChatUser[];
  last_message?: Message;
  unread_count?: number;
}

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  uin: string;
  username?: string;
  status?: 'online' | 'offline';
  online_status?: string;
  custom_status?: string | null;
  last_seen_at?: string | null;
  pivot: {
    chat_id: number;
    user_id: string;
    is_muted: boolean;
    joined_at: string;
    is_active: boolean;
  };
}

// Message Types
export interface Message {
  id: number;
  chat_id: number;
  sender_id: string;
  /** Расшифрованный контент — присутствует только в ответе GET /messages/{id} */
  content?: string;
  encrypted_content?: string;
  encryption_key?: string;
  iv?: string;
  type: 'text' | 'image' | 'voice' | 'video' | 'file';
  created_at: string;
  read_at?: string;
  sender?: User;
  attachments?: Attachment[];
}

export interface SendMessageRequest {
  /** ID существующего чата (либо receiver_id) */
  chat_id?: number;
  /** UUID получателя для создания нового приватного чата (либо chat_id) */
  receiver_id?: string;
  content: string;
  type?: 'text' | 'image' | 'voice' | 'video' | 'file';
}

// Attachment Types
export interface Attachment {
  id: number;
  message_id: number;
  file_path: string;
  mime_type: string;
  size: number;
  name: string;
  created_at: string;
}

// Call Types
export interface Call {
  id?: number;
  call_uuid: string;
  chat_id: number;
  caller_id: string;
  callee_id: string;
  type: 'audio' | 'video';
  status: 'pending' | 'ringing' | 'active' | 'ended' | 'missed' | 'declined' | 'failed';
  duration?: number;
  started_at?: string;
  answered_at?: string;
  ended_at?: string;
}

export interface InitiateCallRequest {
  chat_id: number;
  callee_id: string;
  type: 'audio' | 'video';
  sdp_offer: string;
}

// WebRTC Types
export interface IceCandidateMessage {
  type: 'ice-candidate';
  candidate: string;
  call_uuid: string;
}

export interface SdpMessage {
  type: 'offer' | 'answer';
  sdp: string;
  call_uuid: string;
}

// WebSocket Event Payloads
export interface WsMessageSentPayload {
  message_id: number;
  chat_id: number;
  sender_id: string;
  type: string;
  created_at: string;
}

export interface WsCallUpdatedPayload {
  call_uuid: string;
  chat_id: number;
  caller_id: string;
  callee_id: string;
  type: 'audio' | 'video';
  status: Call['status'];
  updated_at: string;
  sdp_offer?: string;
  sdp_answer?: string;
}

export interface WsUserPresencePayload {
  user_id: string;
  status: 'online' | 'offline';
  online_status: string | null;
  custom_status: string | null;
  last_seen_at: string | null;
}

// Status Types
export interface StatusOption {
  key: string;
  name: string;
  color: string;
  icon: string;
}

// Language Types
export interface Language {
  code: string;
  name: string;
  native_name: string;
}

// Session Types
export interface Session {
  id: number;
  device_name: string;
  ip_address: string;
  confirmed_at: string;
  expires_at: string;
  is_current?: boolean;
}

// Search Types
export interface SearchUserRequest {
  query: string;
}

export interface SearchUserResponse {
  id: string;
  name: string;
  email?: string;
  uin: string;
  username?: string;
}

export interface AvailableStatuses {
  statuses: Record<string, string>;
}

export interface LanguagesResponse {
  supported_locales: string[];
  current_locale: string;
  language_names: Record<string, string>;
  status_names: Record<string, string>;
}

export interface SetUsernameResponse {
  status: 'success';
  username: string;
}

export interface SetStatusResponse {
  status: 'success';
  online_status: string;
  display_status: string;
}

export interface UpdateLocaleResponse {
  status: 'success';
  locale: string;
  language_name: string;
}

export interface UserPublicStatusResponse {
  id: string;
  name: string;
  uin: string;
  is_online: boolean;
  status: string;
  status_key: string;
  last_seen?: string | null;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  status: number;
  error?: string;
}

// File Upload Types
export interface FileUploadRequest {
  file: File;
  messageId: number;
}

export interface FileUploadResponse {
  status: string;
  attachment_id: number;
  file_path: string;
  file_size: number;
  mime_type: string;
}

// Chat Management Types
export interface CreateChatRequest {
  type: 'private' | 'group';
  name?: string;
  user_ids?: string[];
}

export interface AddUserToChatRequest {
  user_id: string;
}

export interface MuteChatRequest {
  is_muted: boolean;
}

// Call Management Types
export interface AnswerCallRequest {
  call_uuid: string;
  sdp_answer: string;
}

export interface SendICECandidateRequest {
  call_uuid: string;
  candidate: string;
}

export interface CallResponse {
  call_uuid: string;
  chat_id: number;
  caller_id: string;
  callee_id: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'active' | 'ended';
  sdp_offer?: string;
}
