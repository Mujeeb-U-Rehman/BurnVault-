from django.contrib import admin

from .models import Contact, FileTransfer, Message, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at', 'updated_at')
    search_fields = ('user__username', 'user__email')


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'sender', 'recipient', 'created_at', 'expires_at')
    list_filter = ('created_at',)
    search_fields = ('sender__username', 'recipient__username')


@admin.register(FileTransfer)
class FileTransferAdmin(admin.ModelAdmin):
    list_display = ('id', 'sender', 'recipient', 'file_name', 'file_size', 'created_at', 'expires_at')
    list_filter = ('created_at',)
    search_fields = ('sender__username', 'recipient__username', 'file_name')


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('user', 'contact_user', 'created_at')
    search_fields = ('user__username', 'contact_user__username')
