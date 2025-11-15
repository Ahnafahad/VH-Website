# VH Design System

**Premium, Modern UI Components for VH Beyond the Horizons**

This design system provides a comprehensive set of accessible, responsive, and beautifully designed components built with React, TypeScript, and Tailwind CSS v4.

---

## 🎨 Design Tokens

All design tokens are defined in `src/app/globals.css` using Tailwind v4's `@theme` syntax.

### Color Palette

#### Brand Colors (Core)
```css
--color-vh-red: #760F13          /* Primary burgundy */
--color-vh-beige: #D4B094        /* Secondary beige */
--color-vh-dark-beige: #A86E58   /* Terracotta */
--color-vh-light-red: #9A1B20    /* Brighter red accent */
--color-vh-dark-red: #5A0B0F     /* Dark burgundy */
```

#### Extended Brand Tints/Shades
- `vh-red-50` through `vh-red-900`
- `vh-beige-50` through `vh-beige-900`

#### Neutral Grays
- `gray-50` through `gray-950`

#### Semantic Colors
- **Success**: `success-50` through `success-900` (Green)
- **Error**: `error-50` through `error-900` (Red-Orange)
- **Warning**: `warning-50` through `warning-900` (Amber)
- **Info**: `info-50` through `info-900` (Blue)

### Typography Scale
- Font sizes: `text-xs` (12px) through `text-9xl` (128px)
- Line heights: `leading-none`, `tight`, `snug`, `normal`, `relaxed`, `loose`
- Font weights: `font-thin` (100) through `font-black` (900)

### Spacing Scale
- `spacing-1` (4px) through `spacing-32` (128px)
- Use with: `p-`, `m-`, `gap-`, etc.

### Border Radius
- `rounded-sm` through `rounded-3xl`, `rounded-full`

### Shadows
- Standard: `shadow-xs` through `shadow-2xl`
- Colored: `shadow-vh-red`, `shadow-vh-beige`

### Transitions
- Durations: `duration-75` through `duration-1000`
- Easings: `ease-linear`, `ease-in`, `ease-out`, `ease-in-out`

### Z-Index
- `z-0` through `z-50`
- Named layers: `z-dropdown` (1000), `z-sticky` (1020), `z-fixed` (1030), `z-modal` (1050), `z-tooltip` (1070)

---

## 📦 Component Library

All components are located in `src/components/ui/` and can be imported from the index:

```typescript
import { Button, Input, Card, Modal } from '@/components/ui';
```

### Form Components

#### Button
Flexible button component with multiple variants and states.

**Props:**
- `variant`: `'solid'` | `'outline'` | `'ghost'` | `'link'` (default: `'solid'`)
- `size`: `'sm'` | `'md'` | `'lg'` (default: `'md'`)
- `colorScheme`: `'primary'` | `'secondary'` | `'success'` | `'error'` | `'warning'` | `'info'` | `'gray'` (default: `'primary'`)
- `isLoading`: `boolean` - Shows spinner
- `leftIcon`: `ReactNode` - Icon before text
- `rightIcon`: `ReactNode` - Icon after text
- `fullWidth`: `boolean` - Full width button

**Example:**
```tsx
<Button
  variant="solid"
  colorScheme="primary"
  size="md"
  leftIcon={<ArrowRight />}
  onClick={handleClick}
>
  Get Started
</Button>
```

#### Input
Text input with label, error states, and icons.

**Props:**
- `label`: `string` - Label text
- `error`: `string` - Error message
- `helperText`: `string` - Helper text below input
- `leftIcon`: `ReactNode` - Icon on left
- `rightIcon`: `ReactNode` - Icon on right
- `fullWidth`: `boolean` - Full width input

**Example:**
```tsx
<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  leftIcon={<Mail size={18} />}
  error={errors.email}
  fullWidth
/>
```

#### Textarea
Multi-line text input.

**Props:**
Same as Input (except icons).

#### Select
Custom-styled dropdown select.

**Props:**
- Same as Input
- `options`: `Array<{value: string, label: string}>` - Dropdown options

**Example:**
```tsx
<Select
  label="Choose University"
  options={[
    { value: 'iba', label: 'IBA DU' },
    { value: 'bup', label: 'BUP' },
  ]}
/>
```

#### Checkbox, Radio, Switch
Selection components with labels.

**Example:**
```tsx
<Checkbox
  label="I agree to the terms and conditions"
  helperText="You must agree to continue"
/>

<Radio
  name="university"
  value="iba"
  label="IBA DU"
/>

<Switch
  label="Enable notifications"
/>
```

---

### Layout & Display Components

#### Card
Flexible card container with variants and padding options.

**Props:**
- `variant`: `'elevated'` | `'outlined'` | `'filled'` (default: `'elevated'`)
- `padding`: `'none'` | `'sm'` | `'md'` | `'lg'` | `'xl'` (default: `'md'`)
- `hoverable`: `boolean` - Adds hover effect

**Subcomponents:**
- `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`

**Example:**
```tsx
<Card variant="elevated" padding="lg" hoverable>
  <CardHeader>
    <CardTitle>Mock Exam Results</CardTitle>
    <CardDescription>Your performance in IBA Mock #5</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Score: 85/100</p>
  </CardContent>
  <CardFooter>
    <Button variant="outline">View Details</Button>
  </CardFooter>
</Card>
```

#### Badge
Small status/label indicators.

**Props:**
- `variant`: `'solid'` | `'outline'` | `'subtle'`
- `colorScheme`: Same as Button
- `size`: `'sm'` | `'md'` | `'lg'`

**Example:**
```tsx
<Badge variant="solid" colorScheme="success">Active</Badge>
<Badge variant="subtle" colorScheme="warning">Pending</Badge>
```

#### Chip
Tag component with optional remove button.

**Props:**
- `variant`: `'filled'` | `'outlined'`
- `colorScheme`: Same as Button
- `onRemove`: `() => void` - Callback when remove clicked
- `leftIcon`: `ReactNode`

**Example:**
```tsx
<Chip
  variant="filled"
  colorScheme="primary"
  leftIcon={<Tag />}
  onRemove={() => console.log('removed')}
>
  Mathematics
</Chip>
```

---

### Overlay Components

#### Modal
Full-featured dialog modal with portal rendering.

**Props:**
- `isOpen`: `boolean`
- `onClose`: `() => void`
- `title`: `string`
- `description`: `string`
- `size`: `'sm'` | `'md'` | `'lg'` | `'xl'` | `'full'`
- `showCloseButton`: `boolean`

**Example:**
```tsx
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Submission"
  description="Are you sure you want to submit your answers?"
  size="md"
>
  <p>This action cannot be undone.</p>
  <ModalFooter>
    <Button variant="outline" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="solid" colorScheme="primary" onClick={handleSubmit}>
      Submit
    </Button>
  </ModalFooter>
</Modal>
```

#### Drawer
Slide-in panel from any direction.

**Props:**
- `isOpen`, `onClose`, `title`, `description`, `showCloseButton` - Same as Modal
- `position`: `'left'` | `'right'` | `'top'` | `'bottom'` (default: `'right'`)
- `size`: `'sm'` | `'md'` | `'lg'` | `'full'`

**Example:**
```tsx
<Drawer
  isOpen={isDrawerOpen}
  onClose={() => setIsDrawerOpen(false)}
  position="right"
  title="Filters"
>
  <div>Filter content here</div>
  <DrawerFooter>
    <Button fullWidth>Apply Filters</Button>
  </DrawerFooter>
</Drawer>
```

#### Toast
Notification system with provider and hook.

**Setup:**
Wrap your app with `ToastProvider` in the root layout:

```tsx
import { ToastProvider } from '@/components/ui';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

**Usage:**
```tsx
import { useToast } from '@/components/ui';

function MyComponent() {
  const { addToast } = useToast();

  const showSuccess = () => {
    addToast({
      type: 'success',
      title: 'Success!',
      description: 'Your form has been submitted.',
      duration: 5000, // optional, default 5000ms
    });
  };

  return <Button onClick={showSuccess}>Submit</Button>;
}
```

**Toast types:** `'success'`, `'error'`, `'warning'`, `'info'`

#### Tooltip
Hover tooltips with positioning.

**Props:**
- `content`: `string` - Tooltip text
- `position`: `'top'` | `'bottom'` | `'left'` | `'right'` (default: `'top'`)

**Example:**
```tsx
<Tooltip content="Click to edit" position="top">
  <Button variant="ghost">Edit</Button>
</Tooltip>
```

---

### Feedback Components

#### Skeleton
Loading placeholders.

**Props:**
- `variant`: `'text'` | `'circular'` | `'rectangular'` | `'rounded'`
- `width`, `height`: `string | number`
- `animation`: `'pulse'` | `'wave'` | `'none'`

**Helpers:**
- `SkeletonText` - Multiple text lines
- `SkeletonCard` - Complete card skeleton

**Example:**
```tsx
<Skeleton variant="text" width="100%" />
<Skeleton variant="circular" width="48px" height="48px" />
<SkeletonText lines={3} />
<SkeletonCard />
```

#### Avatar
User avatar with fallback and status indicator.

**Props:**
- `src`: `string` - Image URL
- `alt`: `string`
- `size`: `'xs'` | `'sm'` | `'md'` | `'lg'` | `'xl'` | `'2xl'`
- `fallback`: `string` - Name for initials
- `status`: `'online'` | `'offline'` | `'away'` | `'busy'`

**Example:**
```tsx
<Avatar
  src="/profile.jpg"
  alt="John Doe"
  size="md"
  status="online"
  fallback="John Doe"
/>

<AvatarGroup max={3} size="md">
  <Avatar src="/user1.jpg" alt="User 1" />
  <Avatar src="/user2.jpg" alt="User 2" />
  <Avatar src="/user3.jpg" alt="User 3" />
  <Avatar src="/user4.jpg" alt="User 4" />
</AvatarGroup>
```

---

### Navigation Components

#### Tabs
Tabbed interface with controlled/uncontrolled state.

**Example:**
```tsx
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>

  <TabsContent value="overview">
    Overview content
  </TabsContent>
  <TabsContent value="analytics">
    Analytics content
  </TabsContent>
  <TabsContent value="settings">
    Settings content
  </TabsContent>
</Tabs>
```

#### Accordion
Expandable/collapsible sections.

**Props:**
- `type`: `'single'` | `'multiple'` - Expand one or multiple items
- `defaultValue`: `string | string[]` - Initially expanded items

**Example:**
```tsx
<Accordion type="single" defaultValue="item-1">
  <AccordionItem value="item-1">
    <AccordionTrigger value="item-1">What is IBA?</AccordionTrigger>
    <AccordionContent value="item-1">
      IBA is the Institute of Business Administration...
    </AccordionContent>
  </AccordionItem>

  <AccordionItem value="item-2">
    <AccordionTrigger value="item-2">How to apply?</AccordionTrigger>
    <AccordionContent value="item-2">
      The application process involves...
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

#### Breadcrumbs
Navigation breadcrumbs.

**Props:**
- `items`: `Array<{label: string, href?: string, icon?: ReactNode}>`
- `showHome`: `boolean` - Show home icon (default: `true`)
- `separator`: `ReactNode` - Custom separator

**Example:**
```tsx
<Breadcrumbs
  showHome
  items={[
    { label: 'Results', href: '/results' },
    { label: 'Mock Exams', href: '/results/mocks' },
    { label: 'IBA Mock #5' },
  ]}
/>
```

#### Pagination
Page navigation with sibling controls.

**Props:**
- `currentPage`: `number`
- `totalPages`: `number`
- `onPageChange`: `(page: number) => void`
- `siblingCount`: `number` - Pages shown on each side (default: `1`)
- `showFirstLast`: `boolean` - Show first/last buttons

**Example:**
```tsx
<Pagination
  currentPage={currentPage}
  totalPages={10}
  onPageChange={setCurrentPage}
  siblingCount={1}
  showFirstLast
/>
```

---

## 🎯 Usage Best Practices

### 1. Import Components
```typescript
// Single import
import { Button } from '@/components/ui';

// Multiple imports
import { Button, Input, Card, Modal } from '@/components/ui';
```

### 2. Use Design Tokens
```tsx
// Use Tailwind classes with our tokens
<div className="bg-vh-red text-white p-6 rounded-2xl shadow-lg">
  <h2 className="text-3xl font-bold mb-4">Title</h2>
  <p className="text-gray-100">Content</p>
</div>
```

### 3. Maintain Consistency
- Use the same `colorScheme` throughout related components
- Stick to the spacing scale (`p-4`, `p-6`, `p-8`, etc.)
- Use semantic colors appropriately (success for confirmations, error for warnings)

### 4. Accessibility
- All components have proper ARIA attributes
- Keyboard navigation is supported
- Focus states are visible
- Color contrast meets WCAG AA standards

### 5. Responsive Design
- Components are mobile-first
- Test on mobile (360-430px), tablet (768-1024px), and desktop (1280px+)
- Use responsive utilities: `md:`, `lg:`, `xl:`

---

## 🚀 Example: Building a Form

```tsx
import { Input, Select, Checkbox, Button, Card, useToast } from '@/components/ui';

function RegistrationForm() {
  const { addToast } = useToast();

  const handleSubmit = (e) => {
    e.preventDefault();
    addToast({
      type: 'success',
      title: 'Registration Successful',
      description: 'Welcome to VH Beyond the Horizons!',
    });
  };

  return (
    <Card variant="elevated" padding="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          label="Full Name"
          placeholder="Enter your full name"
          required
          fullWidth
        />

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          required
          fullWidth
        />

        <Select
          label="Preferred University"
          options={[
            { value: 'iba', label: 'IBA DU' },
            { value: 'bup', label: 'BUP' },
            { value: 'fbs', label: 'DU FBS' },
          ]}
          required
          fullWidth
        />

        <Checkbox
          label="I agree to the terms and conditions"
          required
        />

        <Button
          type="submit"
          variant="solid"
          colorScheme="primary"
          size="lg"
          fullWidth
        >
          Register Now
        </Button>
      </form>
    </Card>
  );
}
```

---

## 📝 Notes

- All components are **fully TypeScript typed**
- Components use **forwardRef** for ref forwarding
- **Portal rendering** for modals, drawers, toasts, tooltips
- **Keyboard accessibility** (Escape to close, Tab navigation)
- **Motion-safe** animations (respects `prefers-reduced-motion`)

---

## 🔄 Next Steps

This design system is ready to use. To apply it across the site:

1. **Refactor existing components** to use new primitives
2. **Apply design tokens** consistently
3. **Add Toast provider** to root layout
4. **Test responsiveness** on all breakpoints
5. **Audit accessibility** with tools like axe DevTools

---

**Happy building! 🎨**
