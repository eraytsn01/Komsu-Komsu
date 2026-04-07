import { z } from 'zod';
import { insertStatusSchema, insertAdvertSchema, insertAnnouncementSchema, insertMessageSchema, insertPrivateMessageSchema } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// Base User type without password for frontend
export const userResponseSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  locationCode: z.string(),
  avatarUrl: z.string().nullable().optional(),
  buildingId: z.number().nullable(),
  isAdmin: z.boolean().nullable(),
  isApproved: z.boolean().nullable(),
});

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/auth/register' as const,
      input: z.object({
        firstName: z.string().min(2),
        lastName: z.string().min(2),
        phone: z.string().min(10),
        email: z.string().email(),
        password: z.string().min(6),
        passwordConfirm: z.string().min(6),
        avatarUrl: z.string().min(1, "Profil fotoğrafı zorunlu"),
        city: z.string().min(1),
        district: z.string().min(1),
        neighborhood: z.string().min(1),
        street: z.string().min(1),
        streetType: z.string().min(1),
        doorNo: z.string().min(1),
      }),
      responses: {
        201: z.object({ message: z.string(), isApproved: z.boolean(), userId: z.number() }),
        400: errorSchemas.validation,
      }
    },
    login: {
      method: 'POST' as const,
      path: '/api/auth/login' as const,
      input: z.object({
        email: z.string().email(),
        password: z.string()
      }),
      responses: {
        200: userResponseSchema,
        401: errorSchemas.unauthorized,
        403: z.object({ message: z.string() }), // For not approved
      }
    },
    logout: {
      method: 'POST' as const,
      path: '/api/auth/logout' as const,
      responses: {
        200: z.object({ message: z.string() })
      }
    },
    me: {
      method: 'GET' as const,
      path: '/api/auth/me' as const,
      responses: {
        200: userResponseSchema,
        401: errorSchemas.unauthorized,
      }
    }
  },
  admin: {
    pendingUsers: {
      method: 'GET' as const,
      path: '/api/admin/pending-users' as const,
      responses: {
        200: z.array(userResponseSchema),
      }
    },
    approveUser: {
      method: 'POST' as const,
      path: '/api/admin/users/:id/approve' as const,
      responses: {
        200: z.object({ message: z.string() }),
      }
    }
  },
  statuses: {
    list: {
      method: 'GET' as const,
      path: '/api/statuses' as const,
      responses: {
        200: z.array(z.any()), // array of statuses with user info
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/statuses' as const,
      input: insertStatusSchema.pick({ content: true, imageUrl: true }),
      responses: {
        201: z.any(),
      }
    },
    view: {
      method: 'POST' as const,
      path: '/api/statuses/:id/view' as const,
      responses: {
        200: z.any(),
      }
    },
    viewers: {
      method: 'GET' as const,
      path: '/api/statuses/:id/viewers' as const,
      responses: {
        200: z.array(z.any()),
      }
    }
  },
  adverts: {
    list: {
      method: 'GET' as const,
      path: '/api/adverts' as const,
      responses: {
        200: z.array(z.any()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/adverts' as const,
      input: insertAdvertSchema.pick({ title: true, description: true, price: true, currency: true, imageUrl: true, visibilityRadius: true }),
      responses: {
        201: z.any(),
      }
    },
    close: {
      method: 'POST' as const,
      path: '/api/adverts/:id/close' as const,
      input: z.object({ reason: z.enum(["sold", "rented", "withdrawn"]) }),
      responses: {
        200: z.any(),
      }
    },
    closeStats: {
      method: 'GET' as const,
      path: '/api/adverts/close-stats' as const,
      responses: {
        200: z.object({ sold: z.number(), rented: z.number(), withdrawn: z.number() }),
      }
    }
  },
  announcements: {
    list: {
      method: 'GET' as const,
      path: '/api/announcements' as const,
      responses: {
        200: z.array(z.any()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/announcements' as const,
      input: insertAnnouncementSchema.pick({ title: true, content: true, imageUrl: true, eventDate: true }),
      responses: {
        201: z.any(),
      }
    }
  },
  messages: {
    list: {
      method: 'GET' as const,
      path: '/api/messages' as const,
      responses: {
        200: z.array(z.any()), // array of messages with user info
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/messages' as const,
      input: insertMessageSchema.pick({ content: true }),
      responses: {
        201: z.any(),
      }
    }
  },
  emergency: {
    list: {
      method: 'GET' as const,
      path: '/api/emergency' as const,
      responses: {
        200: z.array(z.any()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/emergency' as const,
      responses: {
        201: z.any(),
      }
    },
    resolve: {
      method: 'POST' as const,
      path: '/api/emergency/:id/resolve' as const,
      input: z.object({ status: z.enum(['resolved', 'false_alarm']) }),
      responses: {
        200: z.object({ message: z.string() }),
      }
    }
  },
  privateMessages: {
    list: {
      method: 'GET' as const,
      path: '/api/private-messages/:otherUserId' as const,
      responses: {
        200: z.array(z.any()),
      }
    },
    conversations: {
      method: 'GET' as const,
      path: '/api/conversations' as const,
      responses: {
        200: z.array(z.any()),
      }
    },
    create: {
      method: 'POST' as const,
      path: '/api/private-messages' as const,
      input: insertPrivateMessageSchema.pick({ receiverId: true, content: true, fileUrl: true, fileName: true, location: true }),
      responses: {
        201: z.any(),
      }
    }
  },
  ads: {
    list: {
      method: 'GET' as const,
      path: '/api/ads' as const,
      responses: {
        200: z.array(z.any()),
      }
    }
  },
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users' as const,
      responses: {
        200: z.array(userResponseSchema),
      }
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/users/me' as const,
      input: z.object({ avatarUrl: z.string().optional(), firstName: z.string().optional(), lastName: z.string().optional() }),
      responses: {
        200: userResponseSchema,
      }
    },
    pushToken: {
      method: 'POST' as const,
      path: '/api/users/push-token' as const,
      input: z.object({ token: z.string().min(10) }),
      responses: {
        200: userResponseSchema,
      }
    }
  },
  locations: {
    cities: {
      method: 'GET' as const,
      path: '/api/locations/cities' as const,
      responses: {
        200: z.array(z.string()),
      }
    },
    districts: {
      method: 'GET' as const,
      path: '/api/locations/districts' as const,
      responses: {
        200: z.array(z.string()),
      }
    },
    neighborhoods: {
      method: 'GET' as const,
      path: '/api/locations/neighborhoods' as const,
      responses: {
        200: z.array(z.any()),
      }
    },
    streets: {
      method: 'GET' as const,
      path: '/api/locations/streets' as const,
      responses: {
        200: z.array(z.object({ street: z.string(), type: z.string() })),
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
