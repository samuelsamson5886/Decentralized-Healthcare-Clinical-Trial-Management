;; Data Collection Contract
;; Securely stores trial results and observations

(define-data-var admin principal tx-sender)

;; Data entry structure
(define-map data-entries
  uint
  {
    protocol-id: uint,
    patient-id: (string-utf8 50),
    institution: principal,
    timestamp: uint,
    data-hash: (buff 32),
    data-type: (string-utf8 50),
    metadata: (string-utf8 500)
  }
)

;; Counter for data entry IDs
(define-data-var data-id-counter uint u0)

;; Error codes
(define-constant ERR-NOT-ADMIN u400)
(define-constant ERR-NOT-VERIFIED u401)
(define-constant ERR-PROTOCOL-NOT-FOUND u402)
(define-constant ERR-UNAUTHORIZED u403)
(define-constant ERR-ENROLLMENT-NOT-FOUND u404)
(define-constant ERR-NOT-FOUND u405)

;; Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Check if an institution is verified (internal implementation)
(define-read-only (is-verified (institution principal))
  ;; In a real deployment, this would call the institution verification contract
  ;; For now, we'll implement a simple check
  (is-some (map-get? data-entries u0))  ;; This is a placeholder that always returns false for new deployments
)

;; Get protocol details (internal implementation)
(define-read-only (get-protocol-details (protocol-id uint))
  ;; In a real deployment, this would call the protocol registration contract
  ;; For now, we'll return a simple structure
  (some {
    institution: tx-sender,
    title: "Placeholder Protocol",
    description: "Placeholder Description",
    methodology: "Placeholder Methodology",
    start-date: u0,
    end-date: u0,
    status: "pending",
    approval-date: none
  })
)

;; Get enrollment details (internal implementation)
(define-read-only (get-enrollment-details (protocol-id uint) (patient-id (string-utf8 50)))
  ;; In a real deployment, this would call the patient enrollment contract
  ;; For now, we'll return a simple structure
  (some {
    institution: tx-sender,
    enrollment-date: u0,
    consent-hash: 0x0000000000000000000000000000000000000000000000000000000000000000,
    status: "active",
    eligibility-criteria: "Placeholder Criteria"
  })
)

;; Add a new data entry
(define-public (add-data-entry
                (protocol-id uint)
                (patient-id (string-utf8 50))
                (data-hash (buff 32))
                (data-type (string-utf8 50))
                (metadata (string-utf8 500)))
  (let ((new-id (+ (var-get data-id-counter) u1))
        (institution-verified (is-verified tx-sender))
        (protocol (unwrap! (get-protocol-details protocol-id) (err ERR-PROTOCOL-NOT-FOUND)))
        (enrollment (unwrap! (get-enrollment-details protocol-id patient-id) (err ERR-ENROLLMENT-NOT-FOUND))))

    (asserts! institution-verified (err ERR-NOT-VERIFIED))
    (asserts! (is-eq (get institution protocol) tx-sender) (err ERR-UNAUTHORIZED))

    (map-set data-entries
      new-id
      {
        protocol-id: protocol-id,
        patient-id: patient-id,
        institution: tx-sender,
        timestamp: block-height,
        data-hash: data-hash,
        data-type: data-type,
        metadata: metadata
      }
    )

    (var-set data-id-counter new-id)
    (ok new-id)
  )
)

;; Get data entry details
(define-read-only (get-data-entry (data-id uint))
  (map-get? data-entries data-id)
)

;; Verify data integrity
(define-read-only (verify-data-integrity (data-id uint) (data-hash (buff 32)))
  (let ((entry (unwrap! (map-get? data-entries data-id) (err ERR-NOT-FOUND))))
    (ok (is-eq (get data-hash entry) data-hash))
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-ADMIN))
    (var-set admin new-admin)
    (ok true)
  )
)
