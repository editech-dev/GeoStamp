import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Watermark Application E2E Tests', () => {
  let consoleErrors: string[] = [];
  let unexpectedDialogs: string[] = [];

  test.beforeEach(({ page }) => {
    consoleErrors = [];
    unexpectedDialogs = [];

    // Register console event listeners to capture errors and warnings
    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error') {
        consoleErrors.push(`Console Error: ${msg.text()}`);
      } else if (type === 'warning') {
        // Keep track of warnings but maybe don't fail unless they are severe
        console.log(`Console Warning: ${msg.text()}`);
      }
    });

    // Register page-level error listener
    page.on('pageerror', (exception) => {
      consoleErrors.push(`Unhandled Exception: ${exception.message}`);
    });

    // Register dialog listener (alert, confirm, prompt)
    page.on('dialog', (dialog) => {
      unexpectedDialogs.push(`Dialog popup: [${dialog.type()}] ${dialog.message()}`);
      dialog.dismiss().catch(() => {});
    });
  });

  test.afterEach(() => {
    // Assert that no console errors or unhandled exceptions occurred
    expect(consoleErrors).toEqual([]);
    // Assert that no browser alerts or dialogs popped up unexpectedly
    expect(unexpectedDialogs).toEqual([]);
  });

  test('should load page, upload photo, change batch metadata, toggle manual date range, adjust styles, view preview, and download zip', async ({ page }) => {
    // 1. Load the application
    await page.goto('/');
    
    // Check sidebar header
    await expect(page.locator('aside')).toContainText('GeoStamp Pro');
    await expect(page.getByRole('button', { name: 'Procesador de Fotos' })).toBeVisible();

    // 2. Upload a test photo
    const fileInput = page.locator('input[type="file"][multiple]');
    const testFilePath = path.join(__dirname, 'sample-test.jpg');
    await fileInput.setInputFiles(testFilePath);

    // Verify photo is loaded into the queue
    const photoQueue = page.locator('div.grid.grid-cols-1.gap-4').first();
    await expect(photoQueue).toContainText('sample-test.jpg');

    // 3. Edit batch location and status
    const batchLocationInput = page.getByPlaceholder(/Ej\. CITRA DATACENTER/);
    await batchLocationInput.fill('EDIFICIO PRINCIPAL PISO 3');
    
    const batchStatusSelect = page.locator('select').first();
    await batchStatusSelect.selectOption('Durante el Mantenimiento');

    // Verify the photo card in the queue is updated with batch status and location
    const photoCard = page.locator('div.grid.grid-cols-1.gap-4').first().locator('> div').first();
    await expect(photoCard.locator('textarea')).toHaveValue('EDIFICIO PRINCIPAL PISO 3');
    await expect(photoCard.locator('select')).toHaveValue('Durante el Mantenimiento');

    // 4. Toggle Manual Date Range Interpolation
    // Toggle manual range mode
    await page.getByRole('button', { name: 'Asignar Rango Manual' }).click();

    // Interact with custom start DateTimePicker
    await page.getByRole('button', { name: 'Seleccionar fecha y hora de inicio' }).click();
    await page.locator('div.absolute').getByRole('button', { name: '28', exact: true }).last().click();
    await page.locator('div.absolute').locator('select').first().selectOption('8');
    await page.locator('div.absolute').locator('select').nth(1).selectOption('0');
    await page.locator('div.absolute').getByRole('button', { name: 'Aplicar' }).click();

    // Interact with custom end DateTimePicker
    await page.getByRole('button', { name: 'Seleccionar fecha y hora de fin' }).click();
    await page.locator('div.absolute').getByRole('button', { name: '28', exact: true }).last().click();
    await page.locator('div.absolute').locator('select').first().selectOption('17');
    await page.locator('div.absolute').locator('select').nth(1).selectOption('0');
    await page.locator('div.absolute').getByRole('button', { name: 'Aplicar' }).click();

    // Trigger recalculation if needed or wait for auto-update
    await page.getByRole('button', { name: 'Recalcular Ahora' }).click();

    // Verify that the photo's date in the queue has changed to the start date (since there's only 1 photo)
    const photoDateButton = photoCard.locator('button').filter({ hasText: /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/ });
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const expectedDateStr = `28/${pad(now.getMonth() + 1)}/${now.getFullYear()} 08:00`;
    await expect(photoDateButton).toContainText(expectedDateStr);

    // 5. Navigate to "Configuración Visual" Tab and adjust settings
    await page.getByRole('button', { name: 'Configuración Visual' }).click();

    // Make sure config inputs are visible
    const companyInput = page.getByPlaceholder('UNION ELÉCTRICA');
    await companyInput.fill('MI EMPRESA DE PRUEBA');

    // Toggle Box Accent Style (Style B) vs Plain Text (Style A)
    // Style B card button can be clicked
    const styleBButton = page.locator('button:has-text("Caja Compacta con Borde")');
    if (await styleBButton.isVisible()) {
      await styleBButton.click();
    }

    // Toggle GPS switch
    const gpsCheckbox = page.locator('input[type="checkbox"]').first();
    const isGpsChecked = await gpsCheckbox.isChecked();
    await gpsCheckbox.setChecked(!isGpsChecked);

    // 6. Preview watermark rendering
    // Go back to photo processor
    await page.getByRole('button', { name: 'Procesador de Fotos' }).click();

    // Click "Ver Previa"
    await page.getByRole('button', { name: 'Ver Previa' }).click();

    // Verify preview modal is displayed
    const previewModal = page.locator('.fixed.inset-0.z-50');
    await expect(previewModal).toBeVisible();

    // Wait for the preview image to render and load on canvas
    const previewImage = previewModal.locator('img[alt="Watermark preview"]');
    await expect(previewImage).toBeVisible();

    // Close preview modal
    await previewModal.getByRole('button', { name: 'Cerrar' }).first().click();
    await expect(previewModal).not.toBeAttached();

    // 7. Test ZIP Download Generation
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Procesar y Descargar ZIP' }).click();
    
    // Wait for the download process to complete
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.zip');
  });
});
