use rand::Rng;
use sha2::{Digest, Sha256};
use std::time::{SystemTime, UNIX_EPOCH};

/// Generate a 6-digit OTP
pub fn generate_otp() -> String {
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(100000..=999999))
}

/// Hash an OTP for secure storage
pub fn hash_otp(otp: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(otp.as_bytes());
    hex::encode(hasher.finalize())
}

/// Verify OTP against hash using constant-time comparison
pub fn verify_otp(otp: &str, hash: &str) -> bool {
    let otp_hash = hash_otp(otp);
    constant_time_eq(&otp_hash, hash)
}

/// Constant-time string comparison to prevent timing attacks
fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    
    let mut result = 0u8;
    for (a_byte, b_byte) in a.bytes().zip(b.bytes()) {
        result |= a_byte ^ b_byte;
    }
    result == 0
}

/// Get current Unix timestamp
pub fn current_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}

/// Validate email format (basic validation)
pub fn is_valid_email(email: &str) -> bool {
    email.contains('@') && email.contains('.') && email.len() > 5
}

/// Generate a unique challenge ID
pub fn generate_challenge_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_otp() {
        let otp = generate_otp();
        assert_eq!(otp.len(), 6);
        assert!(otp.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_hash_and_verify_otp() {
        let otp = "123456";
        let hash = hash_otp(otp);
        assert!(verify_otp(otp, &hash));
        assert!(!verify_otp("654321", &hash));
    }

    #[test]
    fn test_constant_time_eq() {
        assert!(constant_time_eq("hello", "hello"));
        assert!(!constant_time_eq("hello", "world"));
        assert!(!constant_time_eq("hello", "hello!"));
    }

    #[test]
    fn test_email_validation() {
        assert!(is_valid_email("test@example.com"));
        assert!(!is_valid_email("invalid-email"));
        assert!(!is_valid_email("@.com"));
    }
}