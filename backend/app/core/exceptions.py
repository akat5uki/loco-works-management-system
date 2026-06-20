import logging
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError, DBAPIError

logger = logging.getLogger("app")

def handle_db_error(e: Exception) -> None:
    """
    Catches a database exception and raises a clean, user-friendly HTTPException
    instead of exposing raw stack traces and SQL queries.
    """
    # Log the full exception internally for developer debugging
    logger.error(f"Database error captured: {e}", exc_info=True)

    if isinstance(e, IntegrityError):
        error_msg = str(e.orig) if e.orig else str(e)
        if "duplicate key value" in error_msg:
            # User-friendly mappings for common unique constraint violations
            if "loco_type_pkey" in error_msg or "loco_type_name_key" in error_msg:
                detail = "This Locomotive Type (ID or Name) already exists."
            elif "employees_pkey" in error_msg:
                detail = "An employee with this ticket number is already registered."
            elif "loco_pkey" in error_msg or "loco_number" in error_msg:
                detail = "A locomotive with this number already exists."
            elif "jobs_pkey" in error_msg:
                detail = "A job with this ID already exists."
            else:
                detail = "A record with this unique identifier already exists."
        elif "foreign key constraint" in error_msg:
            detail = "Cannot complete the request because it references a record that does not exist, or is still referenced by other items."
        else:
            detail = "Database integrity violation. Please review your input data."
        raise HTTPException(status_code=400, detail=detail)
    
    elif isinstance(e, DBAPIError):
        raise HTTPException(
            status_code=400,
            detail="A database query error occurred while processing your request."
        )
    
    elif isinstance(e, HTTPException):
        raise e
        
    else:
        raise HTTPException(
            status_code=400,
            detail="An unexpected error occurred while saving the data."
        )
