# InvenCare - Technical Report
## Comprehensive Inventory Management & Analytics System

---

## Executive Summary

InvenCare is a production-ready, full-stack inventory management web application built with modern React.js frontend and Express.js backend. The system integrates AWS Cognito for authentication, RDS MySQL for data persistence, and features comprehensive inventory tracking, demand forecasting, and transaction management capabilities across multiple store locations.

---

## System Architecture

### Overall Architecture Pattern
- **Single Page Application (SPA)** with React Router 6
- **RESTful API Backend** with Express.js
- **Cloud Database** hosted on AWS RDS MySQL
- **Authentication & Authorization** via AWS Cognito
- **Real-time Data Synchronization** between frontend and backend

### Deployment Architecture
```
[User Browser] → [Load Balancer] → [EC2 Instance(s)] → [RDS MySQL Database]
                                           ↓
                                  [AWS Cognito Authentication]
```

---

## Technology Stack

### Frontend Technologies
- **React 18** - Core UI framework with hooks and functional components
- **React Router 6** - Client-side routing in SPA mode
- **TypeScript** - Type-safe development (where configured)
- **Vite** - Build tool and development server
- **TailwindCSS 3** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **Recharts** - Data visualization charts
- **React Query (TanStack)** - Server state management
- **React Hook Form** - Form state management
- **Zod** - Runtime type validation

### Backend Technologies
- **Express.js** - Web application framework
- **Node.js** - Runtime environment
- **MySQL2** - MySQL database driver with connection pooling
- **CORS** - Cross-origin resource sharing middleware
- **JSON** - API data format

### Infrastructure & Deployment
- **AWS EC2** - Application hosting
- **AWS RDS MySQL** - Managed database service
- **AWS Cognito** - User authentication and authorization
- **Application Load Balancer** - Traffic distribution and SSL termination
- **Vite Dev Server** - Development environment with hot reload

---

## Database Architecture

### Core Tables (Currently Used)

#### 1. **stores**
```sql
stores (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  zip_code VARCHAR(20),
  phone VARCHAR(20),
  manager_id VARCHAR(255),
  status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```
- **Purpose**: Multi-store location management
- **Key Features**: Geographic data, manager assignments, operational status
- **Indexes**: `idx_status`, `idx_manager`

#### 2. **categories**
```sql
categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```
- **Purpose**: Product categorization system
- **Key Features**: Hierarchical product organization
- **Sample Categories**: Fruits & Vegetables, Dairy, Meat & Poultry, Beverages, Snacks, Grains

#### 3. **products**
```sql
products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  category VARCHAR(100),
  sku VARCHAR(100),
  barcode VARCHAR(100),
  minimum_stock INT DEFAULT 5,
  maximum_stock INT DEFAULT 100,
  supplier_id INT,
  store_id VARCHAR(50) NOT NULL,
  location_in_store VARCHAR(100),
  status ENUM('active', 'inactive', 'discontinued') DEFAULT 'active',
  category_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
)
```
- **Purpose**: Core inventory management
- **Key Features**: Stock levels, pricing, location tracking, supplier relationships
- **Business Logic**: Automatic status calculation (Available/Low Stock/Out of Stock)
- **Indexes**: `idx_store_category`, `idx_store_sku`, `idx_status`

#### 4. **suppliers**
```sql
suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)
```
- **Purpose**: Supplier relationship management
- **Key Features**: Contact information, vendor tracking

#### 5. **inventory_transactions**
```sql
inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  store_id VARCHAR(50) NOT NULL,
  transaction_type ENUM('sale', 'restock', 'adjustment', 'transfer') NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  reference_number VARCHAR(100) UNIQUE,
  notes TEXT,
  user_id VARCHAR(255),
  user_name VARCHAR(255),
  transfer_to_store_id VARCHAR(50) NULL,
  transfer_to_store_name VARCHAR(255) NULL,
  category VARCHAR(100),
  product_name VARCHAR(255),
  audit_trail JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (transfer_to_store_id) REFERENCES stores(id) ON DELETE SET NULL
)
```
- **Purpose**: Complete transaction history and audit trail
- **Key Features**: Multi-transaction type support, inter-store transfers, user tracking
- **Business Logic**: Reference number auto-generation, audit trail maintenance
- **Indexes**: `idx_product_store`, `idx_transaction_type`, `idx_created_at`, `idx_analytics`

#### 6. **user_store_access**
```sql
user_store_access (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  store_id VARCHAR(50) NOT NULL,
  role ENUM('admin', 'manager', 'employee', 'viewer') NOT NULL,
  granted_by VARCHAR(255),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  status ENUM('active', 'suspended', 'revoked') DEFAULT 'active',
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
)
```
- **Purpose**: Role-based access control per store
- **Key Features**: Granular permissions, time-based access, audit trail
- **Indexes**: `idx_user_store`, `idx_store`, `idx_status`

#### 7. **transaction_audit_log**
```sql
transaction_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  action ENUM('created', 'modified', 'approved', 'rejected', 'voided') NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  old_values JSON,
  new_values JSON,
  reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES inventory_transactions(id) ON DELETE CASCADE
)
```
- **Purpose**: Complete audit trail for all transaction modifications
- **Key Features**: Change tracking, compliance logging, forensic capabilities

### Analytics & Forecasting Tables (Available but not actively used)

The database includes advanced analytics tables that were designed for AI/ML features:
- `demand_forecasting_models`
- `demand_predictions` 
- `product_demand_forecasts`
- `inventory_optimization`
- `market_trends`
- `customer_behavior_analytics`
- `ai_model_metrics`

*Note: These tables are present in the schema but not actively utilized in the current application version.*

---

## Application Modules

### 1. Authentication & Authorization
- **AWS Cognito Integration**: User pools, sign-up, sign-in, password policies
- **Role-Based Access Control**: Admin, Manager, Employee, Viewer roles
- **Store-Level Permissions**: Users can be restricted to specific stores
- **Session Management**: Automatic token refresh and logout

### 2. Dashboard & Analytics
- **Real-time Metrics**: Total products, revenue, low stock alerts, inventory turnover
- **Visual Charts**: Sales trends, category performance pie charts
- **Store Filtering**: Multi-store view with aggregated or individual store data
- **Recent Activity**: Live transaction feed with click-through navigation

### 3. Product Management
- **CRUD Operations**: Full product lifecycle management
- **Advanced Filtering**: By category, store, status, search terms
- **Stock Status Tracking**: Automatic calculation based on minimum thresholds
- **Category Management**: Dynamic category assignment and filtering
- **Bulk Operations**: Multi-product selection and actions

### 4. Transaction Management
- **Multiple Transaction Types**: Sales, Restocks, Adjustments, Transfers
- **Inter-store Transfers**: Products movement between locations
- **Reference Number System**: Automatic generation (SALE-2024-001, RST-2024-002)
- **Real-time Updates**: Immediate inventory adjustments
- **Comprehensive Search**: By product, reference number, user, date range

### 5. Forecasting & Analytics (Interface Ready)
- **AI Model Integration**: Ready for AWS SageMaker integration
- **Demand Prediction**: 30-day forecast capabilities
- **Category Performance**: Analytics by product category
- **Confidence Scoring**: Prediction accuracy metrics
- **Historical Trends**: Time-series analysis interface

---

## Infrastructure Architecture

### AWS EC2 Configuration
**Recommended Instance Type**: t3.medium or t3.large
- **CPU**: 2-4 vCPUs for handling concurrent requests
- **Memory**: 4-8 GB RAM for Node.js application and connection pooling
- **Storage**: EBS gp3 volumes for optimal I/O performance
- **Security Groups**: 
  - Port 80/443 for HTTP/HTTPS traffic
  - Port 22 for SSH management
  - Internal communication ports for load balancer

### Application Load Balancer (ALB)
- **Target Groups**: Multiple EC2 instances for high availability
- **Health Checks**: `/api/health` endpoint monitoring
- **SSL Termination**: TLS/SSL certificate management
- **Sticky Sessions**: Not required (stateless application)
- **Auto Scaling**: Integration with EC2 Auto Scaling Groups

### AWS RDS MySQL Configuration
**Current Connection Details**:
- **Host**: `invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com`
- **Database**: `invencare`
- **Port**: 3306
- **Instance Class**: Recommended db.t3.medium or larger
- **Storage**: General Purpose SSD (gp2) with auto-scaling enabled
- **Multi-AZ**: Enabled for high availability
- **Backup**: Automated backups with 7-day retention
- **Connection Pooling**: 10 concurrent connections (configurable)

### Security Configuration
- **SSL/TLS**: Force SSL connections to RDS
- **VPC**: Private subnets for database, public subnets for ALB
- **IAM Roles**: EC2 instance roles for AWS service access
- **Security Groups**: Principle of least privilege
- **AWS Cognito**: Managed authentication service

---

## API Architecture

### REST API Endpoints

#### Authentication Endpoints
- `GET /api/health` - Health check and database connectivity
- `GET /api/ping` - Basic service availability

#### Product Management
- `GET /api/products` - Retrieve all products with filtering
- `GET /api/products/:id` - Get specific product details
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update existing product
- `DELETE /api/products/:id` - Remove product from inventory

#### Category Management
- `GET /api/categories` - List all product categories

#### Store Management
- `GET /api/stores` - Retrieve store list and details

#### Transaction Management
- `GET /api/transactions` - Transaction history with filtering
- `GET /api/transactions/summary` - Aggregated transaction statistics
- `POST /api/transactions` - Create new transaction
- `GET /api/debug/transactions` - Development debugging endpoint

#### Dashboard Analytics
- `GET /api/dashboard/analytics` - Core dashboard metrics
- `GET /api/dashboard/categories` - Top-selling categories
- `GET /api/dashboard/stores` - Store performance data
- `GET /api/dashboard/low-stock` - Low inventory alerts
- `GET /api/dashboard/transactions` - Recent transaction feed

#### Database Management
- `POST /api/init-database` - Initialize database schema
- `POST /api/database/cleanup` - Data cleanup operations

### API Response Format
```json
{
  "success": true,
  "data": {
    "products": [...],
    "totalCount": 150,
    "pagination": {
      "page": 1,
      "limit": 50,
      "hasMore": true
    }
  },
  "message": "Products retrieved successfully"
}
```

### Error Handling
```json
{
  "success": false,
  "error": "Database connection failed",
  "message": "Unable to connect to the database. Please try again.",
  "statusCode": 500,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Frontend Architecture

### Component Structure
```
client/
├── components/
│   ├── ui/                 # Reusable UI components
│   │   ├── badge.jsx
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   ├── input.jsx
│   │   ├── stat-card.jsx
│   │   └── status-badges.jsx
│   ├── Navigation.jsx      # Main navigation component
│   └── ProtectedRoute.jsx  # Authentication wrapper
├── pages/                  # Route components
│   ├── Dashboard.jsx       # Main dashboard
│   ├── Products.jsx        # Product management
│   ├── Transactions.jsx    # Transaction history
│   ├── Forecasting.jsx     # Analytics interface
│   ├── Login.jsx          # Authentication
│   └── NotFound.jsx       # Error page
├── lib/
│   ├── api.js             # API client functions
│   ├── auth-context.jsx   # Authentication context
│   └── utils.js           # Utility functions
└── App.jsx                # Main app component
```

### State Management
- **React Query**: Server state management and caching
- **React Context**: User authentication and global state
- **Local State**: Component-specific state with useState hooks
- **Form State**: React Hook Form for complex form handling

### Routing Configuration
```javascript
<Routes>
  <Route path="/" element={<Index />} />
  <Route path="/login" element={<Login />} />
  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
  <Route path="/products/:id" element={<ProtectedRoute><ProductInfo /></ProtectedRoute>} />
  <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
  <Route path="/forecasting" element={<ProtectedRoute><Forecasting /></ProtectedRoute>} />
  <Route path="*" element={<ProtectedRoute><NotFound /></ProtectedRoute>} />
</Routes>
```

### UI Design System
- **Theme**: Custom TailwindCSS configuration with CSS variables
- **Colors**: Consistent color palette with light/dark mode support
- **Typography**: Responsive font scaling with Inter font family
- **Components**: Accessible Radix UI primitives with custom styling
- **Icons**: Lucide React icon library
- **Animations**: TailwindCSS animations with custom keyframes

---

## Security Implementation

### Authentication Security
- **AWS Cognito**: Enterprise-grade authentication service
- **Password Policy**: Minimum 8 characters with complexity requirements
- **Multi-Factor Authentication**: Available through Cognito configuration
- **Session Management**: Automatic token refresh and secure logout

### Authorization Model
- **Role-Based Access Control (RBAC)**: Admin, Manager, Employee, Viewer
- **Resource-Level Permissions**: Store-specific access control
- **API Security**: Protected routes with authentication middleware
- **Data Filtering**: Users only see data they have permission to access

### Data Security
- **SQL Injection Prevention**: Parameterized queries with MySQL2
- **XSS Protection**: React's built-in XSS prevention
- **CORS Configuration**: Controlled cross-origin access
- **Input Validation**: Server-side validation for all API endpoints
- **Audit Trail**: Complete transaction history with user tracking

### Infrastructure Security
- **VPC**: Private network isolation for database
- **Security Groups**: Firewall rules with minimum necessary access
- **SSL/TLS**: Encrypted communication for all data transfers
- **IAM Roles**: Principle of least privilege for AWS services

---

## Performance Optimization

### Database Performance
- **Connection Pooling**: MySQL2 connection pool with 10 concurrent connections
- **Indexes**: Optimized indexes on frequently queried columns
- **Query Optimization**: Efficient joins and aggregations
- **Data Pagination**: Limit large result sets to prevent memory issues

### Frontend Performance
- **Code Splitting**: React Router lazy loading for routes
- **Asset Optimization**: Vite build optimization and tree shaking
- **Image Optimization**: Responsive images and lazy loading
- **State Management**: Efficient re-rendering with React Query caching

### Caching Strategy
- **Client-Side Caching**: React Query automatic caching
- **API Response Caching**: Conditional headers for static data
- **Database Query Caching**: MySQL query cache optimization

### Monitoring & Observability
- **Health Checks**: Database connectivity monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time monitoring
- **User Analytics**: Authentication and usage tracking

---

## Development & Deployment

### Development Environment
```bash
# Start development server
npm run dev          # Runs both frontend and backend

# Build for production
npm run build        # Creates optimized production build

# Run tests
npm test            # Execute test suite
```

### Build Process
- **Frontend Build**: Vite builds React SPA to `dist/spa/`
- **Backend Build**: Express server compilation to `dist/server/`
- **Static Assets**: Optimized CSS, JS, and image files
- **Environment Variables**: Production configuration management

### Deployment Strategy
1. **Code Build**: Automated build process on push
2. **EC2 Deployment**: Deploy to staging/production instances
3. **Database Migration**: Automated schema updates
4. **Health Checks**: Verify deployment success
5. **Load Balancer**: Update target groups for zero downtime

### Environment Configuration
```javascript
// Production environment variables
{
  RDS_HOSTNAME: "invencaredb.cihe2wg8etco.us-east-1.rds.amazonaws.com",
  RDS_USERNAME: "admin",
  RDS_PASSWORD: "********",
  RDS_DB_NAME: "invencare",
  RDS_PORT: "3306",
  NODE_ENV: "production"
}
```

---

## Scalability Considerations

### Horizontal Scaling
- **Multi-Instance Architecture**: Load balancer distributes traffic across EC2 instances
- **Database Connection Pooling**: Efficient connection management
- **Stateless Design**: No server-side session storage enables easy scaling

### Vertical Scaling
- **EC2 Instance Upgrades**: Increase CPU/memory as needed
- **RDS Scaling**: Database instance type and storage scaling
- **Connection Pool Tuning**: Adjust pool size for increased load

### Data Growth Management
- **Archival Strategy**: Move old transactions to archive tables
- **Index Optimization**: Monitor and optimize query performance
- **Partitioning**: Date-based partitioning for large transaction tables

---

## Maintenance & Support

### Monitoring Requirements
- **Database Health**: Connection monitoring and query performance
- **Application Logs**: Error tracking and performance metrics
- **User Activity**: Authentication and feature usage analytics
- **System Resources**: CPU, memory, and storage monitoring

### Backup Strategy
- **Database Backups**: Automated RDS backups with point-in-time recovery
- **Application Backups**: Code deployment versioning
- **Configuration Backups**: Environment and security configuration

### Update Procedures
- **Security Updates**: Regular dependency updates and security patches
- **Feature Releases**: Staged deployment with rollback capabilities
- **Database Updates**: Schema migration procedures with backup verification

---

## Cost Optimization

### AWS Resource Optimization
- **EC2 Instance Types**: Right-sized instances based on actual usage
- **RDS Optimization**: Appropriate instance class and storage type
- **Load Balancer**: Efficient target group configuration
- **Data Transfer**: Minimize cross-AZ transfer costs

### Development Efficiency
- **Automated Testing**: Reduce manual QA time
- **CI/CD Pipeline**: Streamlined deployment process
- **Code Quality**: Maintainable codebase reduces support overhead

---

## Future Enhancements

### Planned Features
1. **Advanced Analytics**: Integration with existing analytics database tables
2. **Mobile Responsiveness**: Enhanced mobile UI/UX
3. **Reporting**: PDF/Excel export functionality
4. **API Rate Limiting**: Protection against abuse
5. **Real-time Notifications**: WebSocket integration for live updates

### Technical Improvements
1. **TypeScript Migration**: Full TypeScript implementation
2. **Test Coverage**: Comprehensive unit and integration tests
3. **Performance Monitoring**: Advanced APM integration
4. **Container Deployment**: Docker containerization for easier deployment

---

## Conclusion

InvenCare represents a robust, enterprise-ready inventory management solution built with modern technologies and cloud-native architecture. The system successfully integrates frontend usability with backend reliability, providing a comprehensive platform for multi-store inventory operations.

The architecture supports current business requirements while maintaining flexibility for future enhancements, particularly in the areas of advanced analytics and AI-driven forecasting. The use of AWS managed services ensures high availability, security, and scalability for growing business needs.

---

*Document Version: 1.0*  
*Last Updated: January 2024*  
*Prepared for: InvenCare Technical Review*
