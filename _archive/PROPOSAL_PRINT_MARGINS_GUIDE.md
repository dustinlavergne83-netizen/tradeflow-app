# Proposal Print Page - Padding & Margins Guide

## File Location
`src/pages/ProposalCommercialPublic.jsx`

---

## 🖨️ PRINT-SPECIFIC SETTINGS (Lines 290-327 approx)

### 1. Page Margins (Line ~307)
```css
@page {
  margin: 0.4in 0.3in;  /* TOP/BOTTOM: 0.4in, LEFT/RIGHT: 0.3in */
  size: letter portrait;
}
```
**Adjust these to control the white space around the entire printed page**

### 2. Proposal Container Padding (Line ~322)
```css
.proposal-container {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  margin: 0 !important;
  padding: 10px 20px !important;  /* TOP/BOTTOM: 10px, LEFT/RIGHT: 20px */
  max-width: 100% !important;
  width: 100% !important;
  box-shadow: none !important;
}
```
**Adjust `padding: 10px 20px` to control inner spacing of content**

### 3. Horizontal Divider Spacing (Line ~332)
```css
hr {
  margin: 20px 0 15px 0 !important;  /* TOP: 20px, RIGHT: 0, BOTTOM: 15px, LEFT: 0 */
}
```
**Adjust to control space around the orange divider line**

### 4. Logo Size (Line ~337)
```css
img {
  max-width: 260px !important;
}
```
**Adjust to make logo bigger/smaller**

### 5. Title Size (Line ~342)
```css
h1 {
  font-size: 28px !important;
}
```
**Adjust to make "PROJECT PROPOSAL" title bigger/smaller**

### 6. Table Spacing (Line ~347)
```css
table {
  margin: 10px 0 !important;  /* TOP/BOTTOM: 10px, LEFT/RIGHT: 0 */
}
```
**Adjust to control space around the table**

### 7. Table Cell Padding (Line ~351)
```css
td, th {
  padding: 10px 8px !important;  /* TOP/BOTTOM: 10px, LEFT/RIGHT: 8px */
}
```
**Adjust to control spacing inside table cells**

---

## 📄 SCREEN DISPLAY SETTINGS (Lines 438-545 approx)

### 8. Main Container (Line ~440)
```javascript
proposal: {
  maxWidth: 900,
  margin: "0 auto",
  backgroundColor: "#fff",
  padding: "70px 60px 20px 60px",  /* TOP: 70px, RIGHT: 60px, BOTTOM: 20px, LEFT: 60px */
  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
}
```
**This controls screen display only (not print)**

### 9. Title Section Spacing (Line ~487)
```javascript
titleSection: {
  textAlign: "center",
  margin: "0 0 25px 0",  /* TOP: 0, RIGHT: 0, BOTTOM: 25px, LEFT: 0 */
}
```

### 10. Divider (Screen Display) (Line ~481)
```javascript
divider: {
  border: "none",
  borderTop: "3px solid " + BRAND.accent,
  margin: "50px 0 20px 0",  /* TOP: 50px, RIGHT: 0, BOTTOM: 20px, LEFT: 0 */
}
```

---

## 🎯 QUICK ADJUSTMENT TIPS

### To make content fit better on one page:
1. **Reduce @page margins** - Change `0.4in 0.3in` to `0.3in 0.25in`
2. **Reduce container padding** - Change `10px 20px` to `8px 15px`
3. **Tighten divider** - Change `20px 0 15px 0` to `15px 0 10px 0`
4. **Reduce table padding** - Change `10px 8px` to `8px 6px`
5. **Shrink logo** - Change `260px` to `240px`
6. **Reduce title** - Change `28px` to `26px`

### To spread content more:
- **Do the opposite of the above!**

---

## 📍 Line Numbers Reference

| Setting | Approximate Line Number |
|---------|------------------------|
| `@page` margins | ~307 |
| `.proposal-container` padding | ~322 |
| `hr` margin | ~332 |
| Logo size | ~337 |
| Title size | ~342 |
| Table margin | ~347 |
| Table cell padding | ~351 |

**Note:** Line numbers are approximate and may shift as you edit the file.
