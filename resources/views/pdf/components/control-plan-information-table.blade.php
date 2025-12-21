@php
    // Component variables
    $controlPlan = $controlPlan ?? [];
    $dateOrig = $dateOrig ?? '-';
    $dateRev = $dateRev ?? '-';
@endphp

<div class="control-plan-information-section" style="margin: 20px 0;">
    <!-- Control Plan Information Table -->
    <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
        <tr>
            <!-- First Column -->
            <td style="width: 33.33%; border: 1px solid #000; padding: 8px; vertical-align: top;">
                <div style="margin-bottom: 8px;">
                    <strong>Control Plan Number:</strong><br>
                    {{ $controlPlan['control_plan_number'] ?? '-' }}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Part Number / Latest Change Level:</strong><br>
                    {{ $controlPlan['part_number_latest_change_level'] ?? '-' }}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Part Name / Description:</strong><br>
                    {{ $controlPlan['part_name_description'] ?? '-' }}
                </div>
                <div style="margin-bottom: 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="width: 50%; border: 1px solid #000; padding: 6px;">
                                <strong>Organization/Plant:</strong><br>
                                {{ $controlPlan['organization_plant'] ?? '-' }}
                            </td>
                            <td style="width: 50%; border: 1px solid #000; padding: 6px;">
                                <strong>Organization Code:</strong><br>
                                {{ $controlPlan['organization_code'] ?? '-' }}
                            </td>
                        </tr>
                    </table>
                </div>
            </td>
            
            <!-- Second Column -->
            <td style="width: 33.33%; border: 1px solid #000; padding: 8px; vertical-align: top;">
                <div style="margin-bottom: 8px;">
                    <strong>Key Contact/Phone:</strong><br>
                    {{ $controlPlan['key_contact_phone'] ?? '-' }}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Core Team:</strong><br>
                    {{ $controlPlan['core_team'] ?? '-' }}
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Organization/Plan Approval/Date:</strong><br>
                    {{ $controlPlan['organization_plan_approval_date'] ?? '-' }}
                </div>
                <div style="margin-bottom: 0;">
                    <strong>Other Approval/Date:</strong><br>
                    {{ $controlPlan['other_approval_date'] ?? '-' }}
                </div>
            </td>
            
            <!-- Third Column -->
            <td style="width: 33.33%; border: 1px solid #000; padding: 8px; vertical-align: top;">
                <div style="margin-bottom: 8px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="width: 50%; border: 1px solid #000; padding: 6px;">
                                <strong>Date (Orig.):</strong><br>
                                {{ $dateOrig }}
                            </td>
                            <td style="width: 50%; border: 1px solid #000; padding: 6px;">
                                <strong>Date (Rev.):</strong><br>
                                {{ $dateRev }}
                            </td>
                        </tr>
                    </table>
                </div>
                <div style="margin-bottom: 8px;">
                    <strong>Customer Engineering Approval/Date:</strong><br>
                    {{ $controlPlan['customer_engineering_approval_date'] ?? '-' }}
                </div>
                <div style="margin-bottom: 0;">
                    <strong>Other Approval:</strong><br>
                    {{ $controlPlan['customer_quality_approval_date'] ?? '-' }}
                </div>
            </td>
        </tr>
    </table>
</div>

