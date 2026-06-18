# Import all models here so that Alembic can discover them via Base.metadata
from app.core.database import Base  # noqa
from app.core.audit import AuditLog  # noqa
from app.features.employees.models import Employee, Designation, EmployeeCategory  # noqa
from app.features.jobs.models import Job, Task, EmployeeJobRating  # noqa
from app.features.locos.models import Loco, LocoType  # noqa
from app.features.bookings.models import LocoBooking  # noqa
