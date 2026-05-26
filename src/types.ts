export enum DeviceType {
  Desktop = "Desktop",
  Notebook = "Notebook",
  AllInOne = "All-in-One",
  Other = "Other"
}

export enum OrderStatus {
  Pending = "Pending",
  InProgress = "In Progress",
  WaitingParts = "Waiting for Parts",
  Completed = "Completed",
  Canceled = "Canceled"
}

export enum Priority {
  Low = "Low",
  Normal = "Normal",
  High = "High",
  Urgent = "Urgent"
}

export enum PaymentMethod {
  Cash = "Dinheiro",
  Pix = "Pix",
  CreditCard = "Cartão de Crédito",
  DebitCard = "Cartão de Débito",
  BankTransfer = "Transferência",
  Other = "Outro"
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  reference?: string;
  cep?: string;
  address?: string; // Legacy field, keeping for compatibility if needed or as a concatenated string
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface ServiceOrder {
  id?: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  deviceType: DeviceType;
  deviceBrand: string;
  deviceModel: string;
  serialNumber: string;
  problemDescription: string;
  technicalReport?: string;
  status: OrderStatus;
  priority: Priority;
  partsCost: number;
  serviceCost: number;
  totalCost: number;
  paymentMethod?: PaymentMethod;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  createdBy: string;
}

export interface InventoryItem {
  id?: string;
  name: string;
  description?: string;
  quantity: number;
  costPrice: number;
  salePrice: number;
  createdAt: any;
  updatedAt: any;
}

export interface Sale {
  id?: string;
  productName: string;
  quantity: number;
  costPrice: number;
  salePrice: number;
  profit: number;
  soldAt: any;
}
