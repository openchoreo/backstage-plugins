import { Entity } from '@backstage/catalog-model';
import { JsonValue } from '@backstage/types';

/**
 * Reference to a specific key in a Kubernetes Secret.
 */
export interface NotificationSecretKeyRef {
  name?: string;
  key?: string;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * Reference to a value sourced from a Kubernetes Secret key.
 */
export interface NotificationSecretValueFrom {
  secretKeyRef?: NotificationSecretKeyRef;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * SMTP authentication configuration for an email notification channel.
 */
export interface NotificationSmtpAuth {
  username?: NotificationSecretValueFrom;
  password?: NotificationSecretValueFrom;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * TLS configuration for the SMTP connection.
 */
export interface NotificationSmtpTlsConfig {
  insecureSkipVerify?: boolean;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * SMTP server configuration for an email notification channel.
 */
export interface NotificationSmtpConfig {
  host: string;
  port: number;
  auth?: NotificationSmtpAuth;
  tls?: NotificationSmtpTlsConfig;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * Email subject/body templates (CEL expressions).
 */
export interface NotificationEmailTemplate {
  subject: string;
  body: string;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * Configuration for the "email" notification channel type.
 */
export interface NotificationEmailConfig {
  from: string;
  to: string[];
  smtp: NotificationSmtpConfig;
  template: NotificationEmailTemplate;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * A single webhook header value, either inline or sourced from a secret.
 */
export interface NotificationWebhookHeaderValue {
  value?: string;
  valueFrom?: NotificationSecretValueFrom;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * Configuration for the "webhook" notification channel type.
 */
export interface NotificationWebhookConfig {
  url: string;
  headers?: Record<string, NotificationWebhookHeaderValue>;
  payloadTemplate?: string;
  /**
   * Index signature for JSON compatibility
   */
  [key: string]: JsonValue | undefined;
}

/**
 * Backstage catalog ObservabilityAlertsNotificationChannel kind Entity.
 * Represents an OpenChoreo notification channel used by alert rules.
 *
 * @public
 */
export interface ObservabilityAlertsNotificationChannelEntityV1alpha1
  extends Entity {
  /**
   * The apiVersion string of the ObservabilityAlertsNotificationChannel.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ObservabilityAlertsNotificationChannel';
  /**
   * The specification of the ObservabilityAlertsNotificationChannel Entity
   */
  spec: {
    /**
     * The name of the environment this channel is scoped to (immutable).
     */
    environment: string;
    /**
     * Whether this is the default notification channel for the environment.
     */
    isEnvDefault?: boolean;
    /**
     * The notification channel type.
     */
    type: 'email' | 'webhook';
    /**
     * Email channel configuration (present when type is "email").
     */
    emailConfig?: NotificationEmailConfig;
    /**
     * Webhook channel configuration (present when type is "webhook").
     */
    webhookConfig?: NotificationWebhookConfig;
    /**
     * Index signature for JSON compatibility
     */
    [key: string]: JsonValue | undefined;
  };
}
