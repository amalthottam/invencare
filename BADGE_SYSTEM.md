# Uniform Badge System

This document outlines the standardized badge system implemented across the InvenCare application for consistent visual representation of categories, statuses, roles, and departments.

## 🎯 Components Created

### 1. StatusBadge Component

**Purpose**: Uniform styling for all status indicators across the application.

**Supported Statuses**:

- **Product Statuses**: Available (green), Low Stock (gray), Out of Stock (red)
- **User Statuses**: Active (green), Inactive (gray), Pending (gray)
- **Forecast Statuses**: Normal (green), Warning (gray), Critical (red)
- **General Statuses**: Online (green), Offline (gray), Error (red), Success (green)

**Usage**:

```jsx
import { StatusBadge } from "@/components/ui/status-badges";
<StatusBadge status="Available" />;
```

### 2. CategoryBadge Component

**Purpose**: Color-coded category tags with consistent styling.

**Supported Categories**:

- **Fruits & Vegetables**: Green theme
- **Dairy**: Blue theme
- **Bakery**: Amber theme
- **Meat & Poultry**: Red theme
- **Seafood**: Cyan theme
- **Grains & Cereals**: Yellow theme
- **Cooking Essentials**: Purple theme
- **Beverages**: Indigo theme
- **Snacks**: Orange theme

**Features**:

- Custom color schemes for visual distinction
- Consistent hover effects
- Outline variant with colored backgrounds

**Usage**:

```jsx
import { CategoryBadge } from "@/components/ui/status-badges";
<CategoryBadge category="Fruits & Vegetables" />;
```

### 3. RoleBadge Component

**Purpose**: Consistent role indicators for user management.

**Supported Roles**:

- **Admin**: Red (destructive) - highest authority
- **Manager**: Blue (default) - management level
- **Employee**: Gray (secondary) - standard user
- **Supervisor**: Blue (default) - team lead
- **Guest**: Outline - limited access

**Usage**:

```jsx
import { RoleBadge } from "@/components/ui/status-badges";
<RoleBadge role="Manager" />;
```

### 4. DepartmentBadge Component

**Purpose**: Department-specific color coding for organizational clarity.

**Supported Departments**:

- **Sales**: Emerald theme
- **Inventory**: Slate theme
- **Finance**: Blue theme
- **HR**: Pink theme
- **IT**: Violet theme
- **Operations**: Teal theme

**Usage**:

```jsx
import { DepartmentBadge } from "@/components/ui/status-badges";
<DepartmentBadge department="Sales" />;
```

## 🎨 Design System

### Color Consistency

- **Success/Available/Active**: Green variations
- **Warning/Low Stock**: Gray/secondary variations
- **Error/Critical/Out of Stock**: Red/destructive variations
- **Info/Default**: Blue variations

### Typography

- **Font Size**: `text-xs` (12px) for all badges
- **Font Weight**: `font-semibold` for readability
- **Text Color**: High contrast based on background

### Layout

- **Padding**: `px-2.5 py-0.5` for consistent spacing
- **Border Radius**: `rounded-full` for modern appearance
- **Whitespace**: `whitespace-nowrap` to prevent text wrapping
- **Alignment**: `justify-center` for centered text

## 📁 Implementation Details

### Files Updated

**Core Badge Component**:

- `client/components/ui/status-badges.tsx` - New unified badge components

**Page Updates**:

- `client/pages/Products.tsx` - Product categories and statuses
- `client/pages/Dashboard.tsx` - Dashboard status indicators
- `client/pages/Dashboard.jsx` - JavaScript dashboard version
- `client/pages/Settings.tsx` - User roles, departments, and statuses
- `client/pages/Forecasting.tsx` - Forecast urgency and categories

### Benefits

1. **Visual Consistency**: All status and category indicators use the same styling patterns
2. **Semantic Color Coding**: Colors have consistent meaning across the application
3. **Maintainability**: Single source of truth for badge styling
4. **Accessibility**: High contrast ratios and semantic markup
5. **Scalability**: Easy to add new categories or statuses

### Migration Notes

**Removed Functions**:

- `getStatusBadge()` functions from individual pages
- `getRoleBadge()` function from Settings page
- Individual `Badge` implementations with hardcoded variants

**Replaced With**:

- Centralized badge components with consistent styling
- Automatic color mapping based on content type
- Unified hover and focus states

## 🚀 Usage Guidelines

### When to Use Each Component

**StatusBadge**:

- Product availability indicators
- User account status
- System health indicators
- Process completion status

**CategoryBadge**:

- Product categorization
- Content classification
- Inventory grouping

**RoleBadge**:

- User permission levels
- Access control indicators
- Team hierarchy display

**DepartmentBadge**:

- Organizational structure
- Team assignments
- Resource allocation

### Customization

The badge components support additional CSS classes via the `className` prop:

```jsx
<StatusBadge status="Available" className="ml-2" />
<CategoryBadge category="Dairy" className="text-lg" />
```

### Adding New Categories/Statuses

To add new categories or statuses:

1. Update the relevant mapping object in `status-badges.tsx`
2. Add color scheme if needed
3. Ensure consistent naming across the application

## 🎯 Future Enhancements

Potential improvements to consider:

1. **Icon Integration**: Add icons to status badges for better visual recognition
2. **Animation Support**: Subtle animations for state changes
3. **Tooltip Integration**: Additional context on hover
4. **Size Variants**: Small, medium, large badge sizes
5. **Custom Themes**: Support for different color themes (dark mode)

The uniform badge system provides a solid foundation for consistent UI elements while maintaining flexibility for future enhancements.
