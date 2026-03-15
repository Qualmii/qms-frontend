import axios from 'axios';
import type { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import type {
  ApiResponse,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  LoginResponse,
  ConfirmLoginRequest,
  ConfirmLoginResponse,
  User,
  Chat,
  Message,
  Attachment,
  SendMessageRequest,
  Call,
  InitiateCallRequest,
  SearchUserRequest,
  SearchUserResponse,
  Session,
  LanguagesResponse,
  ApiError,
  SetUsernameResponse,
  SetStatusResponse,
  UpdateLocaleResponse,
  AvailableStatuses,
  UserPublicStatusResponse
} from '@/types/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
      timeout: 10000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'ru',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('auth_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: AxiosError): ApiError {
    if (error.response) {
      const data = error.response.data as { message?: string; error?: string; errors?: Record<string, string[]> };
      return {
        message: data?.message ?? data?.error ?? 'An error occurred',
        error: data?.error,
        errors: data?.errors,
        status: error.response.status,
      };
    } else if (error.request) {
      return {
        message: 'Network error - please check your connection',
        status: 0,
      };
    } else {
      return {
        message: error.message || 'An unexpected error occurred',
        status: 0,
      };
    }
  }

  // Authentication
  async register(data: RegisterRequest): Promise<AxiosResponse<RegisterResponse>> {
    return this.client.post('/register', data);
  }

  async login(data: LoginRequest): Promise<AxiosResponse<LoginResponse>> {
    return this.client.post('/login', data);
  }

  async confirmLogin(data: ConfirmLoginRequest): Promise<AxiosResponse<ConfirmLoginResponse>> {
    return this.client.post('/login/confirm', data);
  }

  async logout(): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post('/logout');
  }

  async refresh(): Promise<AxiosResponse<ConfirmLoginResponse>> {
    return this.client.post('/refresh');
  }

  async getCurrentUser(): Promise<AxiosResponse<User>> {
    return this.client.get('/me');
  }

  // User Profile
  async getProfile(): Promise<AxiosResponse<User>> {
    return this.client.get('/users/profile');
  }

  async setUsername(username: string): Promise<AxiosResponse<SetUsernameResponse>> {
    return this.client.post('/users/username', { username });
  }

  async deleteUsername(): Promise<AxiosResponse<ApiResponse>> {
    return this.client.delete('/users/username');
  }

  async uploadAvatar(file: File): Promise<AxiosResponse<{ status: string; avatar_url: string }>> {
    const formData = new FormData()
    formData.append('avatar', file)
    return this.client.post('/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }

  async deleteAvatar(): Promise<AxiosResponse<ApiResponse>> {
    return this.client.delete('/users/avatar')
  }

  async searchUsers(params: SearchUserRequest): Promise<AxiosResponse<SearchUserResponse>> {
    return this.client.get('/users/search', { params });
  }

  async getUserByIdentifier(identifier: string): Promise<AxiosResponse<SearchUserResponse>> {
    return this.client.get(`/users/${identifier}`);
  }

  // Languages
  async getLanguages(): Promise<AxiosResponse<LanguagesResponse>> {
    return this.client.get('/languages');
  }

  async updateLocale(locale: string): Promise<AxiosResponse<UpdateLocaleResponse>> {
    return this.client.put('/users/locale', { locale });
  }

  // Sessions
  async getSessions(): Promise<AxiosResponse<Session[]>> {
    return this.client.get('/sessions');
  }

  async endSession(sessionId: number): Promise<AxiosResponse<ApiResponse>> {
    return this.client.delete(`/sessions/${sessionId}`);
  }

  async endOtherSessions(): Promise<AxiosResponse<ApiResponse>> {
    return this.client.delete('/sessions/others');
  }

  // Status
  async setStatus(status: string, customMessage?: string): Promise<AxiosResponse<SetStatusResponse>> {
    return this.client.post('/users/status', { online_status: status, custom_status: customMessage });
  }

  async getAvailableStatuses(): Promise<AxiosResponse<AvailableStatuses>> {
    return this.client.get('/users/status/available');
  }

  async getUserStatus(identifier: string): Promise<AxiosResponse<UserPublicStatusResponse>> {
    return this.client.get(`/users/${identifier}/status`);
  }

  // Chats
  async getChats(): Promise<AxiosResponse<Chat[]>> {
    return this.client.get('/chats');
  }

  async createChat(data: { type: 'private' | 'group'; name?: string; user_ids?: string[] }): Promise<AxiosResponse<Chat>> {
    return this.client.post('/chats', data);
  }

  async getChat(chatId: number): Promise<AxiosResponse<Chat>> {
    return this.client.get(`/chats/${chatId}`);
  }

  async updateChat(chatId: number, data: { name?: string }): Promise<AxiosResponse<Chat>> {
    return this.client.put(`/chats/${chatId}`, data);
  }

  async deleteChat(chatId: number): Promise<AxiosResponse<ApiResponse>> {
    return this.client.delete(`/chats/${chatId}`);
  }

  async addUserToChat(chatId: number, userId: string): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post(`/chats/${chatId}/add-user`, { user_id: userId });
  }

  async removeUserFromChat(chatId: number, userId: string): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post(`/chats/${chatId}/remove-user/${userId}`);
  }

  async toggleChatMute(chatId: number): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post(`/chats/${chatId}/mute`);
  }

  async getOrCreatePrivateChat(userId: string): Promise<AxiosResponse<Chat>> {
    return this.client.post(`/chats/get-or-create-private/${userId}`);
  }

  async getOrCreateFavoritesChat(): Promise<AxiosResponse<Chat>> {
    return this.client.get('/chats/favorites/get-or-create');
  }

  // Messages
  async sendMessage(data: SendMessageRequest): Promise<AxiosResponse<{ id: number; chat_id: number; status: string; created_at: string }>> {
    return this.client.post('/messages', data);
  }

  async getMessage(messageId: number): Promise<AxiosResponse<Message>> {
    return this.client.get(`/messages/${messageId}`);
  }

  async getMessages(params?: { chat_id?: number; page?: number; limit?: number }): Promise<AxiosResponse<Message[]>> {
    return this.client.get('/messages', { params });
  }

  async uploadFile(messageId: number, file: File): Promise<AxiosResponse<ApiResponse>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.client.post(`/messages/${messageId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  // Attachments
  async getAttachment(attachmentId: number): Promise<AxiosResponse<Attachment>> {
    return this.client.get(`/attachments/${attachmentId}`);
  }

  async downloadAttachment(attachmentId: number): Promise<AxiosResponse<Blob>> {
    return this.client.get(`/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
  }

  async deleteAttachment(attachmentId: number): Promise<AxiosResponse<ApiResponse>> {
    return this.client.delete(`/attachments/${attachmentId}`);
  }

  async getMessageAttachments(messageId: number): Promise<AxiosResponse<Attachment[]>> {
    return this.client.get(`/messages/${messageId}/attachments`);
  }

  // Calls
  async initiateCall(data: InitiateCallRequest): Promise<AxiosResponse<Call>> {
    return this.client.post('/calls/initiate', data);
  }

  async answerCall(callUuid: string, sdpAnswer: string): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post('/calls/answer', { call_uuid: callUuid, sdp_answer: sdpAnswer });
  }

  async addIceCandidate(callUuid: string, candidate: string): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post('/calls/ice-candidate', { call_uuid: callUuid, candidate });
  }

  async declineCall(callUuid: string): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post(`/calls/${callUuid}/decline`);
  }

  async endCall(callUuid: string): Promise<AxiosResponse<ApiResponse>> {
    return this.client.post(`/calls/${callUuid}/end`);
  }

  async getCall(callUuid: string): Promise<AxiosResponse<Call>> {
    return this.client.get(`/calls/${callUuid}`);
  }
}

export const apiClient = new ApiClient();
