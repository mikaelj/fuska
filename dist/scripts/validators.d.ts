interface ValidationResult {
    valid: boolean;
    errors: string[];
}
/** Validates a plan concept has all required fields */
export declare function validatePlanConcept(data: unknown): ValidationResult;
/** Validates a summary concept has all required fields */
export declare function validateSummaryConcept(data: unknown): ValidationResult;
/** Validates state concept structure */
export declare function validateStateConcept(data: unknown): ValidationResult;
/** Validates config concept structure */
export declare function validateConfigConcept(data: unknown): ValidationResult;
export {};
//# sourceMappingURL=validators.d.ts.map